<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'type',
        'value',
        'starts_at',
        'expires_at',
        'quota',
        'per_user_limit',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'starts_at' => 'date',
        'expires_at' => 'date',
        'quota' => 'integer',
        'per_user_limit' => 'integer',
    ];

    /**
     * UML Method: isValid(): bool
     */
    public function isValid(?int $userId = null): bool
    {
        $today = Carbon::today();

        if ($today->lt($this->starts_at) || $today->gt($this->expires_at)) {
            return false;
        }

        if ($this->quota <= $this->usages()->count()) {
            return false;
        }

        if ($userId) {
            $userUsage = $this->usages()->where('user_id', $userId)->count();
            if ($userUsage >= $this->per_user_limit) {
                return false;
            }
        }

        return true;
    }

    public function usages(): HasMany
    {
        return $this->hasMany(CouponUsage::class);
    }
}
