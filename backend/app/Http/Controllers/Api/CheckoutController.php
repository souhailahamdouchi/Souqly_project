<?php

namespace App\Http\Controllers\Api;

use App\Enums\CommissionStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\ShippingZone;
use App\Models\Stock;
use App\Models\SubOrder;
use App\Support\Notifier;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    /**
     * Get available shipping zones and their delivery fees
     */
    public function getShippingZones(): JsonResponse
    {
        $zones = ShippingZone::orderBy('city')->get();
        return response()->json($zones);
    }

    /**
     * Check stock for current cart items
     * UML Use Case: Vérifier le stock
     */
    public function verifyStock(Request $request): JsonResponse
    {
        $user = $request->user();
        $cart = Cart::with('items.variant.stock')->where('user_id', $user->id)->first();

        if (!$cart || $cart->items->isEmpty()) {
            return response()->json(['valid' => false, 'message' => 'Le panier est vide.'], 400);
        }

        $outOfStock = [];
        foreach ($cart->items as $item) {
            $variant = $item->variant;
            $available = $variant->stock->quantity ?? 0;
            if ($available < $item->quantity) {
                $outOfStock[] = [
                    'item_id' => $item->id,
                    'product_name' => $variant->product->name ?? 'Article',
                    'requested' => $item->quantity,
                    'available' => $available,
                ];
            }
        }

        if (!empty($outOfStock)) {
            return response()->json([
                'valid' => false,
                'message' => 'Certains articles ne sont plus disponibles en quantité demandée.',
                'items' => $outOfStock,
            ], 422);
        }

        return response()->json([
            'valid' => true,
            'message' => 'Tous les articles sont en stock.',
        ]);
    }

    /**
     * Validate and apply coupon
     * UML Use Case: Appliquer coupon
     */
    public function applyCoupon(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string',
            'subtotal' => 'required|numeric|min:0',
        ]);

        $coupon = Coupon::where('code', strtoupper($validated['code']))->first();

        if (!$coupon) {
            return response()->json(['valid' => false, 'message' => 'Coupon introuvable.'], 404);
        }

        $userId = $request->user()?->id;

        if (!$coupon->isValid($userId)) {
            return response()->json(['valid' => false, 'message' => 'Ce coupon a expiré ou a dépassé son quota.'], 422);
        }

        $subtotal = (float) $validated['subtotal'];
        $discount = 0.0;

        if ($coupon->type === 'percentage') {
            $discount = round(($subtotal * $coupon->value) / 100, 2);
        } else {
            $discount = min((float) $coupon->value, $subtotal);
        }

        return response()->json([
            'valid' => true,
            'coupon_id' => $coupon->id,
            'code' => $coupon->code,
            'type' => $coupon->type,
            'value' => $coupon->value,
            'discount' => $discount,
            'new_total' => max(0, $subtotal - $discount),
        ]);
    }

    /**
     * Place an order in a single transaction.
     * UML Use Case: Passer commande
     *
     * Guarantees:
     * - idempotency (unique idempotency_key + race fallback)
     * - consistent stock (variant rows locked FOR UPDATE, RM-003)
     * - server-side pricing, coupon & shipping fee computation
     * - 7% commission recorded per vendor sub-order (RM-008)
     * - transactional rollback on any failure (stock, DB constraint...)
     */
    public function placeOrder(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'shipping_address_id' => 'required|exists:addresses,id',
            'shipping_zone_id' => 'nullable|exists:shipping_zones,id',
            'payment_method' => 'required|string|in:cash_on_delivery,card,stripe,cmi',
            'coupon_code' => 'nullable|string',
            'idempotency_key' => 'nullable|string|max:100',
        ]);

        // Fast-path idempotency check to prevent duplicate orders
        if (!empty($validated['idempotency_key'])) {
            $existing = Order::where('idempotency_key', $validated['idempotency_key'])->first();
            if ($existing) {
                return response()->json([
                    'message' => 'Commande déjà traitée.',
                    'order' => $existing->load(['subOrders.items', 'payments']),
                ]);
            }
        }

        $cart = Cart::with(['items.variant.product.vendor', 'items.variant.stock'])
            ->where('user_id', $user->id)
            ->first();

        if (!$cart || $cart->items->isEmpty()) {
            return response()->json(['message' => 'Votre panier est vide.'], 400);
        }

        // Early stock sanity check (authoritative check happens under lock)
        foreach ($cart->items as $item) {
            if (!$item->variant->stock || $item->variant->stock->quantity < $item->quantity) {
                return response()->json([
                    'message' => 'Stock insuffisant pour: ' . ($item->variant->product->name ?? 'Article'),
                ], 422);
            }
        }

        // Shipping address must belong to the authenticated user
        $address = Address::where('user_id', $user->id)->find($validated['shipping_address_id']);
        if (!$address) {
            return response()->json(['message' => 'Adresse de livraison introuvable.'], 422);
        }

        // Determine shipping fee
        $shippingFee = 0.0;
        if (!empty($validated['shipping_zone_id'])) {
            $zone = ShippingZone::find($validated['shipping_zone_id']);
            $shippingFee = (float) ($zone->fee ?? 0);
        } else {
            // Find zone by address city
            $city = mb_strtolower($address->city ?? '');
            $zone = ShippingZone::whereRaw('LOWER(city) LIKE ?', ['%'.$city.'%'])->first();
            $shippingFee = (float) ($zone->fee ?? 25.00);
        }

        $subtotal = $cart->total();
        $discount = 0.0;
        $appliedCoupon = null;

        // Apply coupon if given
        if (!empty($validated['coupon_code'])) {
            $appliedCoupon = Coupon::where('code', strtoupper($validated['coupon_code']))->first();
            if ($appliedCoupon && $appliedCoupon->isValid($user->id)) {
                if ($appliedCoupon->type === 'percentage') {
                    $discount = round(($subtotal * $appliedCoupon->value) / 100, 2);
                } else {
                    $discount = min((float) $appliedCoupon->value, $subtotal);
                }
            }
        }

        $total = max(0, $subtotal + $shippingFee - $discount);

        try {
            $order = DB::transaction(function () use (
                $user,
                $validated,
                $cart,
                $subtotal,
                $shippingFee,
                $discount,
                $total,
                $appliedCoupon
            ) {
                $orderNumber = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));

                // 1. Create Order
                $order = Order::create([
                    'user_id' => $user->id,
                    'shipping_address_id' => $validated['shipping_address_id'],
                    'shipping_zone_id' => $validated['shipping_zone_id'] ?? null,
                    'number' => $orderNumber,
                    'subtotal' => $subtotal,
                    'shipping_fee' => $shippingFee,
                    'discount' => $discount,
                    'total' => $total,
                    'status' => OrderStatus::EN_ATTENTE,
                    'idempotency_key' => $validated['idempotency_key'] ?? null,
                ]);

                // 2. Lock variant stock rows (FOR UPDATE) — prevents overselling
                $variantIds = $cart->items->pluck('product_variant_id')->unique()->all();

                $stocks = Stock::whereIn('product_variant_id', $variantIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('product_variant_id');

                foreach ($cart->items as $item) {
                    $stock = $stocks->get($item->product_variant_id);

                    if (!$stock || $stock->quantity < $item->quantity) {
                        throw ValidationException::withMessages([
                            'cart' => 'Stock insuffisant pour : ' . ($item->variant->product->name ?? 'Article') . '.',
                        ]);
                    }

                    $item->variant->setRelation('stock', $stock);
                }

                // 3. Group cart items by Vendor to create SubOrders
                $itemsByVendor = $cart->items->groupBy(fn($item) => $item->variant->product->vendor_id);

                foreach ($itemsByVendor as $vendorId => $items) {
                    $subtotalVendor = $items->sum(function ($item) {
                        $price = $item->variant->price ?? $item->variant->product->price;
                        return $price * $item->quantity;
                    });

                    $subOrder = SubOrder::create([
                        'order_id' => $order->id,
                        'vendor_id' => $vendorId,
                        'subtotal' => $subtotalVendor,
                        'status' => OrderStatus::EN_ATTENTE,
                    ]);

                    $vendor = $items->first()->variant->product->vendor;
                    $commRate = (float) ($vendor->commission_rate ?? 7.00);

                    foreach ($items as $item) {
                        $variant = $item->variant;
                        $product = $variant->product;
                        $unitPrice = $variant->price ?? $product->price;

                        OrderItem::create([
                            'sub_order_id' => $subOrder->id,
                            'product_variant_id' => $variant->id,
                            'quantity' => $item->quantity,
                            'product_name' => $product->name,
                            'sku' => $variant->sku,
                            'unit_price' => $unitPrice,
                            'commission_rate' => $commRate,
                        ]);

                        // Decrement stock (locked instance, RM-003 guaranteed)
                        $variant->stock->decrease($item->quantity);
                    }

                    // Record commission for vendor sub_order (status EN_ATTENTE until payment)
                    $commAmount = round(($subtotalVendor * $commRate) / 100, 2);
                    $subOrder->commissions()->create([
                        'vendor_id' => $vendorId,
                        'rate' => $commRate,
                        'amount' => $commAmount,
                        'status' => CommissionStatus::EN_ATTENTE,
                    ]);
                }

                // 4. Record coupon usage
                if ($appliedCoupon) {
                    CouponUsage::create([
                        'coupon_id' => $appliedCoupon->id,
                        'user_id' => $user->id,
                        'order_id' => $order->id,
                        'used_at' => Carbon::now(),
                    ]);
                }

                // 5. Create Payment
                $providerRef = $validated['payment_method'] === 'cash_on_delivery'
                    ? 'COD-' . $orderNumber
                    : strtoupper($validated['payment_method']) . '-' . $orderNumber;

                Payment::create([
                    'order_id' => $order->id,
                    'method' => $validated['payment_method'],
                    'status' => PaymentStatus::EN_ATTENTE,
                    'amount' => $total,
                    'provider_ref' => $providerRef,
                ]);

                // 6. Order status history (creation)
                $order->createHistory('CREATION', OrderStatus::EN_ATTENTE->value);

                // 7. Clear cart
                $cart->items()->delete();

                // 8. Notify the client (Notification journal)
                Notifier::send($user, 'COMMANDE_CREEE', [
                    'order_id' => $order->id,
                    'order_number' => $orderNumber,
                    'total' => (float) $total,
                    'payment_method' => $validated['payment_method'],
                ]);

                return $order;
            });
        } catch (QueryException $e) {
            // Race-condition fallback on unique idempotency constraint
            if (!empty($validated['idempotency_key']) && str_contains($e->getMessage(), 'idempotency')) {
                $existing = Order::where('idempotency_key', $validated['idempotency_key'])->first();
                if ($existing) {
                    return response()->json([
                        'message' => 'Commande déjà traitée.',
                        'order' => $existing->load(['subOrders.items', 'payments']),
                    ]);
                }
            }

            throw $e;
        }

        return response()->json([
            'message' => 'Commande passée avec succès !',
            'order' => $order->load(['subOrders.items', 'payments', 'shippingAddress']),
        ], 201);
    }
}
