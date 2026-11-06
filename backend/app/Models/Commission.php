<?php

namespace App\Models;

use App\Enums\CommissionStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Commission extends Model
{
    use HasFactory;

    protected $fillable = [
        'sub_order_id',
        'vendor_id',
        'payout_id',
        'rate',
        'amount',
        'status',
    ];

    protected $casts = [
        'rate' => 'decimal:2',
        'amount' => 'decimal:2',
        'status' => CommissionStatus::class,
    ];

    /**
     * UML Method: compute(): decimal
     */
    public function compute(): float
    {
        if ($this->subOrder) {
            $computed = ($this->subOrder->subtotal * $this->rate) / 100;
            $this->update(['amount' => $computed]);
            return (float) $computed;
        }

        return (float) $this->amount;
    }

    public function subOrder(): BelongsTo
    {
        return $this->belongsTo(SubOrder::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(Payout::class);
    }
}
