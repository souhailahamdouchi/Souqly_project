<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shipment extends Model
{
    use HasFactory;

    protected $fillable = [
        'sub_order_id',
        'carrier_id',
        'tracking_number',
        'status',
        'shipped_at',
    ];

    protected $casts = [
        'shipped_at' => 'datetime',
    ];

    public function subOrder(): BelongsTo
    {
        return $this->belongsTo(SubOrder::class);
    }

    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Carrier::class);
    }
}
