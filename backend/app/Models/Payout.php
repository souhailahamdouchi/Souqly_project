<?php

namespace App\Models;

use App\Enums\PayoutStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payout extends Model
{
    use HasFactory;

    protected $fillable = [
        'vendor_id',
        'period_start',
        'period_end',
        'gross_amount',
        'commission_total',
        'refunds_total',
        'net_amount',
        'status',
        'paid_at',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'gross_amount' => 'decimal:2',
        'commission_total' => 'decimal:2',
        'refunds_total' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'status' => PayoutStatus::class,
        'paid_at' => 'datetime',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(Commission::class);
    }
}
