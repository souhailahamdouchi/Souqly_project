<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'method',
        'status',
        'amount',
        'provider_ref',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'status' => PaymentStatus::class,
    ];

    /**
     * UML Method: verifyWebhook(): bool
     *
     * Verifies the authenticity of a gateway webhook using an HMAC-SHA256
     * signature. The gateway signs the RAW request body and sends the
     * signature in a header (e.g. X-Signature).
     *
     * An empty configured secret falls back to a permissive dev-mode so
     * local integrations keep working without a signing infrastructure.
     */
    public function verifyWebhook(string $rawPayload, ?string $signature): bool
    {
        $secret = (string) env('PAYMENT_WEBHOOK_SECRET');

        if ($secret === '') {
            return true;
        }

        if (empty($signature)) {
            return false;
        }

        $expected = hash_hmac('sha256', $rawPayload, $secret);

        return hash_equals($expected, $signature);
    }

    /**
     * Mark the payment as successfully collected.
     */
    public function markPaid(): void
    {
        $this->update(['status' => PaymentStatus::PAYE]);
    }

    /**
     * Mark the payment as failed.
     */
    public function markFailed(): void
    {
        $this->update(['status' => PaymentStatus::ECHOUE]);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }
}
