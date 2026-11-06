<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class CartController extends Controller
{
    /**
     * Get or create cart for user or guest session.
     * Manually resolves Sanctum token because cart routes are public (no auth:sanctum middleware).
     * When the user is authenticated, the guest cart (X-Session-Id) is merged into the user cart.
     */
    protected function getOrCreateCart(Request $request): Cart
    {
        $user = $request->user();

        // If no user resolved (route outside auth:sanctum), try Bearer token manually
        if (!$user && $token = $request->bearerToken()) {
            $accessToken = PersonalAccessToken::findToken($token);
            if ($accessToken) {
                $user = $accessToken->tokenable;
            }
        }

        if ($user) {
            $userCart = Cart::firstOrCreate(['user_id' => $user->id]);

            // Merge the abandoned guest cart on the first request after login
            $sessionId = $request->header('X-Session-Id');
            if ($sessionId && $sessionId !== 'guest-ephemeral') {
                $guestCart = Cart::with('items')->where('session_id', $sessionId)->first();
                if ($guestCart && $guestCart->id !== $userCart->id && $guestCart->items->isNotEmpty()) {
                    foreach ($guestCart->items as $item) {
                        $existing = CartItem::where('cart_id', $userCart->id)
                            ->where('product_variant_id', $item->product_variant_id)
                            ->first();
                        if ($existing) {
                            $existing->increment('quantity', $item->quantity);
                        } else {
                            CartItem::create([
                                'cart_id' => $userCart->id,
                                'product_variant_id' => $item->product_variant_id,
                                'quantity' => $item->quantity,
                            ]);
                        }
                    }
                    $guestCart->items()->delete();
                    $guestCart->delete();
                }
            }

            return $userCart;
        }

        $sessionId = $request->header('X-Session-Id') ?: $request->input('session_id') ?: session()->getId();
        return Cart::firstOrCreate(['session_id' => $sessionId]);
    }

    /**
     * Get current cart content and total
     */
    public function index(Request $request): JsonResponse
    {
        $cart = $this->getOrCreateCart($request);
        $cart->load(['items.variant.product.images', 'items.variant.stock']);

        return response()->json([
            'cart_id' => $cart->id,
            'items' => $cart->items,
            'total' => $cart->total(),
            'count' => $cart->items->sum('quantity'),
        ]);
    }

    /**
     * Add variant to cart
     */
    public function addItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_variant_id' => 'required|exists:product_variants,id',
            'quantity' => 'nullable|integer|min:1',
        ]);

        $quantity = $validated['quantity'] ?? 1;
        $variant = ProductVariant::with('stock')->findOrFail($validated['product_variant_id']);

        if (!$variant->stock || $variant->stock->quantity < $quantity) {
            return response()->json([
                'message' => 'Stock insuffisant pour cette variante.',
                'available_stock' => $variant->stock->quantity ?? 0,
            ], 422);
        }

        $cart = $this->getOrCreateCart($request);

        $cartItem = CartItem::firstOrNew([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
        ]);

        $newQty = ($cartItem->exists ? $cartItem->quantity : 0) + $quantity;

        if ($variant->stock->quantity < $newQty) {
            return response()->json([
                'message' => 'Quantité totale demandée supérieure au stock disponible.',
                'available_stock' => $variant->stock->quantity,
            ], 422);
        }

        $cartItem->quantity = $newQty;
        $cartItem->save();

        return response()->json([
            'message' => 'Article ajouté au panier',
            'cart_item' => $cartItem->load('variant.product'),
            'total' => $cart->total(),
        ]);
    }

    /**
     * Update item quantity
     */
    public function updateItem(Request $request, int $itemId): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => 'required|integer|min:1',
        ]);

        $cart = $this->getOrCreateCart($request);
        $cartItem = CartItem::where('cart_id', $cart->id)->findOrFail($itemId);

        $variant = $cartItem->variant()->with('stock')->first();
        if ($variant->stock && $variant->stock->quantity < $validated['quantity']) {
            return response()->json([
                'message' => 'Stock insuffisant.',
                'available_stock' => $variant->stock->quantity,
            ], 422);
        }

        $cartItem->update(['quantity' => $validated['quantity']]);

        return response()->json([
            'message' => 'Panier mis à jour',
            'cart_item' => $cartItem,
            'total' => $cart->total(),
        ]);
    }

    /**
     * Remove item from cart
     */
    public function removeItem(Request $request, int $itemId): JsonResponse
    {
        $cart = $this->getOrCreateCart($request);
        $cartItem = CartItem::where('cart_id', $cart->id)->findOrFail($itemId);
        $cartItem->delete();

        return response()->json([
            'message' => 'Article supprimé du panier',
            'total' => $cart->total(),
        ]);
    }

    /**
     * Clear all items in cart
     */
    public function clear(Request $request): JsonResponse
    {
        $cart = $this->getOrCreateCart($request);
        $cart->items()->delete();

        return response()->json([
            'message' => 'Panier vidé',
        ]);
    }
}
