<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminProductController extends Controller
{
    /**
     * List products pending approval
     */
    public function pending(): JsonResponse
    {
        $products = Product::where('status', ProductStatus::EN_ATTENTE)
            ->with(['vendor.user', 'category', 'brand', 'variants.stock', 'images'])
            ->orderBy('created_at', 'asc')
            ->paginate(15);

        return response()->json($products);
    }

    /**
     * Validate/publish product
     * UML: Valider un produit
     */
    public function validateProduct(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $before = $product->toArray();

        $product->update(['status' => ProductStatus::PUBLIE]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'VALIDATE_PRODUCT',
            'entity_type' => Product::class,
            'entity_id' => $product->id,
            'before' => $before,
            'after' => $product->fresh()->toArray(),
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Produit validé et publié sur le catalogue.',
            'product' => $product,
        ]);
    }

    /**
     * Reject product
     */
    public function rejectProduct(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $before = $product->toArray();

        $product->update(['status' => ProductStatus::REFUSE]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'REJECT_PRODUCT',
            'entity_type' => Product::class,
            'entity_id' => $product->id,
            'before' => $before,
            'after' => $product->fresh()->toArray(),
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Produit refusé.',
            'product' => $product,
        ]);
    }
}
