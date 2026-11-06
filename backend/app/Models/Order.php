<?php

namespace App\Models;

use App\Enums\CommissionStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Support\Notifier;
use Exception;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'shipping_address_id',
        'shipping_zone_id',
        'number',
        'subtotal',
        'shipping_fee',
        'discount',
        'total',
        'status',
        'idempotency_key',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'shipping_fee' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
        'status' => OrderStatus::class,
    ];

    /**
     * Record a status transition in the order history (RM-010 journaling).
     */
    public function createHistory(string $fromStatus, string $toStatus): OrderStatusHistory
    {
        return OrderStatusHistory::create([
            'order_id' => $this->id,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'created_at' => now(),
        ]);
    }

    /**
     * UML Method: place(): void
     */
    public function place(): void
    {
        $this->changeStatus(OrderStatus::CONFIRMEE);
    }

    /**
     * Recompute the parent order status from the state of its sub-orders.
     *
     * - Every sub-order LIVREE            -> order LIVREE (COD payments settled,
     *                                        commissions acknowledged as DUE)
     * - Every sub-order EXPEDIEE|LIVREE   -> order EXPEDIEE
     * - Every sub-order past EN_ATTENTE   -> order CONFIRMEE
     * - No active sub-order left          -> order ANNULEE
     *
     * Idempotent: no-op when the computed status equals the current one.
     */
    public function refreshStatusFromSubOrders(): void
    {
        // Normalize: pluck() may return BackedEnum instances (via casts) or plain strings
        $statuses = $this->subOrders()->pluck('status')
            ->values()
            ->map(fn($s) => $s instanceof \BackedEnum ? $s->value : $s);

        $active = $statuses->reject(
            fn($s) => in_array($s, [OrderStatus::ANNULEE->value, OrderStatus::REMBOURSEE->value], true)
        );

        if ($active->isEmpty()) {
            $this->changeStatus(OrderStatus::ANNULEE, 'COMMANDE_ANNULEE');
            return;
        }

        if ($active->every(fn($s) => $s === OrderStatus::LIVREE->value)) {
            $newStatus = OrderStatus::LIVREE;
        } elseif ($active->every(fn($s) => in_array($s, [OrderStatus::EXPEDIEE->value, OrderStatus::LIVREE->value], true))) {
            $newStatus = OrderStatus::EXPEDIEE;
        } elseif ($active->every(fn($s) => $s !== OrderStatus::EN_ATTENTE->value)) {
            $newStatus = OrderStatus::CONFIRMEE;
        } else {
            $newStatus = OrderStatus::EN_ATTENTE;
        }

        $this->changeStatus($newStatus);

        if ($newStatus === OrderStatus::LIVREE) {
            $this->settleCashOnDelivery();
        }
    }

    /**
     * At delivery (RM-005): collect COD payments and acknowledge commissions.
     */
    protected function settleCashOnDelivery(): void
    {
        $this->payments()
            ->where('method', 'cash_on_delivery')
            ->where('status', PaymentStatus::EN_ATTENTE->value)
            ->update(['status' => PaymentStatus::PAYE->value]);

        foreach ($this->subOrders()->with('commissions')->get() as $subOrder) {
            $subOrder->commissions()
                ->where('status', CommissionStatus::EN_ATTENTE->value)
                ->update(['status' => CommissionStatus::DUE->value]);
        }
    }

    /**
     * Internal transition helper: history row + notification (RM-010).
     */
    protected function changeStatus(OrderStatus $newStatus, ?string $type = null): void
    {
        if ($this->status === $newStatus) {
            return;
        }

        $fromStatus = $this->status->value;
        $this->createHistory($fromStatus, $newStatus->value);
        $this->update(['status' => $newStatus]);

        Notifier::send($this->user, $type ?? 'COMMANDE_STATUT', [
            'order_id' => $this->id,
            'order_number' => $this->number,
            'from_status' => $fromStatus,
            'to_status' => $newStatus->value,
        ]);
    }

    /**
     * UML Method: cancel(): void
     *
     * Cancels the order. If a payment was already collected, it is refunded
     * (Refund record + REMBOURSE) and the order becomes REMBOURSEE, otherwise
     * the order is ANNULEE and pending payments marked ECHOUE.
     * Commissions are voided, stock is restored and coupon quota is freed.
     */
    public function cancel(): void
    {
        if (in_array($this->status, [OrderStatus::EXPEDIEE, OrderStatus::LIVREE], true)) {
            throw new Exception("Impossible d'annuler une commande déjà expédiée ou livrée.");
        }

        DB::transaction(function () {
            $hasPaidPayment = $this->payments()
                ->where('status', PaymentStatus::PAYE->value)
                ->exists();

            if ($hasPaidPayment) {
                $this->refundPayments();
                $this->changeStatus(OrderStatus::REMBOURSEE, 'COMMANDE_REMBOURSEE');

                $subOrderStatus = OrderStatus::REMBOURSEE;
            } else {
                $this->changeStatus(OrderStatus::ANNULEE, 'COMMANDE_ANNULEE');

                $this->payments()
                    ->where('status', PaymentStatus::EN_ATTENTE->value)
                    ->update(['status' => PaymentStatus::ECHOUE->value]);

                $subOrderStatus = OrderStatus::ANNULEE;
            }

            $subOrders = $this->subOrders()->with('items.variant.stock')->get();

            foreach ($subOrders as $subOrder) {
                $subOrder->update(['status' => $subOrderStatus]);

                $subOrder->commissions()->update(['status' => CommissionStatus::ANNULEE->value]);

                foreach ($subOrder->items as $item) {
                    if ($item->variant?->stock) {
                        $item->variant->stock->increase(
                            $item->quantity,
                            'Annulation commande #' . $this->number
                        );
                    }
                }
            }

            // Free the coupon usage quota consumed by this order
            CouponUsage::where('order_id', $this->id)->delete();
        });
    }

    /**
     * Create refund records and mark collected payments as REFUNDED.
     */
    protected function refundPayments(): void
    {
        $payments = $this->payments()
            ->where('status', PaymentStatus::PAYE->value)
            ->get();

        foreach ($payments as $payment) {
            $payment->refunds()->create([
                'amount' => $payment->amount,
                'reason' => 'Annulation commande #' . $this->number,
                'status' => 'en_attente',
            ]);

            $payment->update(['status' => PaymentStatus::REMBOURSE->value]);
        }
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shippingAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'shipping_address_id');
    }

    public function shippingZone(): BelongsTo
    {
        return $this->belongsTo(ShippingZone::class, 'shipping_zone_id');
    }

    public function subOrders(): HasMany
    {
        return $this->hasMany(SubOrder::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function couponUsages(): HasMany
    {
        return $this->hasMany(CouponUsage::class);
    }
}
