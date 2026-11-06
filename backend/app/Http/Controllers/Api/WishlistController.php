<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Wishlist;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $wishlists = Wishlist::where('user_id', $request->user()->id)
            ->with(['product.images', 'product.variants.stock'])
            ->get();

        return response()->json($wishlists);
    }

    public function toggle(Request $request, int $productId): JsonResponse
    {
        $user = $request->user();

        // The product must exist (404 otherwise)
        Product::findOrFail($productId);

        $existing = Wishlist::where('user_id', $user->id)->where('product_id', $productId)->first();

        if ($existing) {
            $existing->delete();
            return response()->json(['message' => 'Produit retiré des favoris', 'in_wishlist' => false]);
        }

        Wishlist::create([
            'user_id' => $user->id,
            'product_id' => $productId,
            'created_at' => Carbon::now(),
        ]);

        return response()->json(['message' => 'Produit ajouté aux favoris', 'in_wishlist' => true], 201);
    }
}
