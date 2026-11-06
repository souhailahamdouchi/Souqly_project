<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'stock_id',
        'delta',
        'reason',
        'created_at',
    ];

    protected $casts = [
        'delta' => 'integer',
        'created_at' => 'datetime',
    ];

    public function stock(): BelongsTo
    {
        return $this->belongsTo(Stock::class);
    }
}
