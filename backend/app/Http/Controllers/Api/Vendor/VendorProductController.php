<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Enums\ProductStatus;
use App\Enums\VendorStatus;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\Stock;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VendorProductController extends Controller
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
     * List products of the authenticated vendor (RM-002 isolation).
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        $products = $vendor->products()
            ->with(['category', 'brand', 'variants.stock', 'images'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json([
            'data' => $products->items(),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    /**
     * Create a new product draft for the vendor (UML: Gérer ses produits).
     * Rule RM-001: only vendors with status APPROUVE may publish.
     * Rule RM-011: the target category must be active.
     */
    public function store(Request $request): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        if ($vendor->status !== VendorStatus::APPROUVE) {
            return response()->json([
                'message' => 'Votre compte vendeur doit être approuvé par l\'administration avant de publier des produits.',
            ], 403);
        }

        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'brand_id' => 'nullable|exists:brands,id',
            'name' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'promo_price' => 'nullable|numeric|min:0',
            'description' => 'required|string|min:10',
            'variants' => 'required|array|min:1',
            'variants.*.sku' => 'required|string|max:64|unique:product_variants,sku',
            'variants.*.size' => 'required|string|max:50',
            'variants.*.color' => 'required|string|max:50',
            'variants.*.price' => 'required|numeric|min:0',
            'variants.*.stock' => 'required|integer|min:0',
            'images' => 'nullable|array|max:6',
            'images.*.path' => 'required_with:images|string|max:500',
        ]);

        $category = Category::find($validated['category_id']);
        if (!$category || !$category->is_active) {
            return response()->json([
                'message' => 'La catégorie sélectionnée est inactive ou introuvable.',
            ], 422);
        }

        $product = DB::transaction(function () use ($vendor, $validated) {
            $product = Product::create([
                'vendor_id' => $vendor->id,
                'category_id' => $validated['category_id'],
                'brand_id' => $validated['brand_id'] ?? null,
                'name' => $validated['name'],
                'slug' => Str::slug($validated['name']) . '-' . strtolower(Str::random(4)),
                'price' => $validated['price'],
                'promo_price' => $validated['promo_price'] ?? null,
                'status' => ProductStatus::BROUILLON,
                'description' => $validated['description'],
            ]);

            foreach ($validated['variants'] as $index => $variantData) {
                $variant = ProductVariant::create([
                    'product_id' => $product->id,
                    'sku' => $variantData['sku'],
                    'size' => $variantData['size'],
                    'color' => $variantData['color'],
                    'price' => $variantData['price'],
                ]);

                $stock = Stock::create([
                    'product_variant_id' => $variant->id,
                    'quantity' => (int) $variantData['stock'],
                    'low_threshold' => 5,
                ]);

                $stock->movements()->create([
                    'delta' => (int) $variantData['stock'],
                    'reason' => 'Stock initial (création produit)',
                ]);
            }

            foreach (($validated['images'] ?? []) as $position => $imageData) {
                ProductImage::create([
                    'product_id' => $product->id,
                    'path' => $imageData['path'],
                    'position' => $position,
                ]);
            }

            return $product;
        });

        return response()->json([
            'message' => 'Produit créé en brouillon. Soumettez-le pour validation.',
            'product' => $product->load(['category', 'brand', 'variants.stock', 'images']),
        ], 201);
    }

    /**
     * Submit a product for admin validation (UML: Soumettre produit).
     * Allowed from BROUILLON or REFUSE states.
     */
    public function submit(Request $request, int $id): JsonResponse
    {
        $vendor = $this->vendorFrom($request);
        $product = $vendor->products()->findOrFail($id);

        if ($product->status === ProductStatus::EN_ATTENTE) {
            $product->load(['category', 'brand', 'variants', 'images']);
            return response()->json([
                'message' => 'Ce produit est déjà en attente de validation.',
                'product' => $product,
            ]);
        }

        if (!in_array($product->status, [ProductStatus::BROUILLON, ProductStatus::REFUSE], true)) {
            return response()->json([
                'message' => 'Seuls les produits en brouillon ou refusés peuvent être soumis pour validation.',
            ], 422);
        }

        $product->submit();

        $product->load(['category', 'brand', 'variants', 'images']);

        return response()->json([
            'message' => 'Produit soumis à l\'administration pour validation.',
            'product' => $product,
        ]);
    }

    /**
     * Delete a product draft. Published products must be deactivated instead.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $vendor = $this->vendorFrom($request);
        $product = $vendor->products()->findOrFail($id);

        if ($product->status === ProductStatus::PUBLIE) {
            return response()->json([
                'message' => 'Un produit publié ne peut pas être supprimé ; désactivez-le plutôt.',
            ], 422);
        }

        $product->delete();

        return response()->json(['message' => 'Produit supprimé avec succès.']);
    }
}
