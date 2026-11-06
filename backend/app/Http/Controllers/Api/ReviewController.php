<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    /**
     * Submit review for product
     * UML Use Case: Déposer un avis
     *
     * - One review per user per product (unique DB constraint enforced)
     * - is_verified = the product was purchased and the order delivered (RM-009)
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'order_item_id' => 'nullable|exists:order_items,id',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'required|string|min:5|max:1000',
        ]);

        // Duplicate guard: one review per user and per product
        if (Review::where('user_id', $user->id)->where('product_id', $validated['product_id'])->exists()) {
            return response()->json([
                'message' => 'Vous avez déjà déposé un avis pour ce produit.',
            ], 422);
        }

        // RM-009: verified purchase requires a delivered order of the user
        $isVerified = OrderItem::where('product_variant_id', function ($q) use ($validated) {
            $q->select('id')->from('product_variants')->where('product_id', $validated['product_id']);
        })->whereHas('subOrder.order', function ($q) use ($user) {
            $q->where('user_id', $user->id)
              ->where('status', OrderStatus::LIVREE->value);
        })->exists();

        $review = Review::create([
            'user_id' => $user->id,
            'product_id' => $validated['product_id'],
            'order_item_id' => $validated['order_item_id'] ?? null,
            'rating' => $validated['rating'],
            'comment' => $validated['comment'],
            'status' => 'en_attente', // Requires admin moderation
            'is_verified' => $isVerified,
        ]);

        return response()->json([
            'message' => 'Votre avis a été soumis avec succès et sera publié après modération.',
            'review' => $review,
        ], 201);
    }

    /**
     * Get reviews for a product
     */
    public function productReviews(int $productId): JsonResponse
    {
        $reviews = Review::where('product_id', $productId)
            ->where('status', 'approuve')
            ->with('user:id,name')
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json($reviews);
    }
}
