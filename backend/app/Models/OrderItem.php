<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sub_order_id',
        'product_variant_id',
        'quantity',
        'product_name',
        'sku',
        'unit_price',
        'commission_rate',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'commission_rate' => 'decimal:2',
        'quantity' => 'integer',
    ];

    public function subOrder(): BelongsTo
    {
        return $this->belongsTo(SubOrder::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }
}
