<?php

namespace App\Models;

use Exception;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stock extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_variant_id',
        'quantity',
        'low_threshold',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'low_threshold' => 'integer',
    ];

    /**
     * Apply a signed quantity adjustment.
     * Rule RM-003: the quantity can never become negative — otherwise an
     * exception is thrown and nothing is persisted.
     * Every adjustment generates a traced StockMovement (database logging).
     */
    public function adjust(int $delta, string $reason): void
    {
        $newQuantity = $this->quantity + $delta;

        if ($newQuantity < 0) {
            throw new Exception("Stock insuffisant pour cette variante.");
        }

        $this->update(['quantity' => $newQuantity]);

        $this->movements()->create([
            'delta' => $delta,
            'reason' => $reason,
        ]);
    }

    /**
     * Add units back to the stock (cancellation, restocking).
     */
    public function increase(int $qty, string $reason): void
    {
        $this->adjust($qty, $reason);
    }

    /**
     * UML Method: decrease(qty: int): void
     */
    public function decrease(int $qty): void
    {
        $this->adjust(-$qty, 'Vente / Décrémentation commande');
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
