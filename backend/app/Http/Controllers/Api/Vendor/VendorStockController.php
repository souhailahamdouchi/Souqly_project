<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use App\Models\Vendor;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorStockController extends Controller
{
    /**
     * Resolve the authenticated vendor profile or abort.
     */
    protected function vendorFrom(Request $request): Vendor
    {
        $vendor = $request->user()->vendor;

        if (!$vendor) {
            abort(403, 'Aucun profil vendeur associé à ce compte.');
        }

        return $vendor;
    }

    /**
     * List all stock rows of the vendor's variants (RM-007 isolation).
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        $stocks = Stock::whereExists(function ($query) use ($vendor) {
                $query->selectRaw(1)
                    ->from('product_variants as pv')
                    ->join('products as p', 'p.id', '=', 'pv.product_id')
                    ->whereColumn('pv.id', 'stocks.product_variant_id')
                    ->where('p.vendor_id', $vendor->id);
            })
            ->with(['variant.product:id,name,vendor_id'])
            ->orderBy('id')
            ->get()
            ->map(fn(Stock $stock) => [
                'stock_id' => $stock->id,
                'product_id' => $stock->variant?->product?->id,
                'product_name' => $stock->variant?->product?->name ?? 'Article',
                'sku' => $stock->variant?->sku ?? '',
                'size' => $stock->variant?->size,
                'color' => $stock->variant?->color,
                'quantity' => $stock->quantity,
                'low_threshold' => $stock->low_threshold,
                'is_low' => $stock->quantity <= $stock->low_threshold,
            ]);

        return response()->json([
            'data' => $stocks,
        ]);
    }

    /**
     * Adjust stock quantity by a delta with a traced movement
     * (UML: Gérer ses stocks). Never allows negative quantity (RM-003).
     */
    public function updateStock(Request $request, int $id): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        $stock = Stock::with('variant.product')->find($id);

        if (!$stock || $stock->variant?->product?->vendor_id !== $vendor->id) {
            return response()->json(['message' => 'Stock introuvable.'], 404);
        }

        $validated = $request->validate([
            'delta' => 'required|integer',
            'reason' => 'nullable|string|max:255',
        ]);

        try {
            $stock->adjust(
                (int) $validated['delta'],
                $validated['reason'] ?? 'Ajustement manuel vendeur'
            );
        } catch (Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'current_quantity' => $stock->fresh()->quantity,
            ], 422);
        }

        $stock->refresh();

        return response()->json([
            'message' => 'Stock mis à jour avec succès.',
            'stock' => [
                'id' => $stock->id,
                'product_variant_id' => $stock->product_variant_id,
                'quantity' => $stock->quantity,
                'low_threshold' => $stock->low_threshold,
            ],
        ]);
    }
}
