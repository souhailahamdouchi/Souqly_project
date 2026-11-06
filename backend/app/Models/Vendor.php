<?php

namespace App\Models;

use App\Enums\VendorStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'shop_name',
        'status',
        'commission_rate',
    ];

    protected $casts = [
        'status' => VendorStatus::class,
        'commission_rate' => 'decimal:2',
    ];

    /**
     * UML Method: approve(): void
     */
    public function approve(): void
    {
        $this->update(['status' => VendorStatus::APPROUVE]);
    }

    /**
     * UML Method: suspend(): void
     */
    public function suspend(): void
    {
        $this->update(['status' => VendorStatus::SUSPENDU]);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function subOrders(): HasMany
    {
        return $this->hasMany(SubOrder::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(Commission::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class);
    }
}
