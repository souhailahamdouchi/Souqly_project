<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    /**
     * Search and list published products
     */
    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'brand', 'vendor', 'images', 'variants.stock'])
            ->where('status', ProductStatus::PUBLIE);

        // Search by keyword (PORTABLE: case-insensitive match on Postgres, MySQL and SQLite)
        if ($search = $request->input('search')) {
            $needle = '%'.mb_strtolower($search).'%';
            $query->where(function ($q) use ($needle) {
                $q->whereRaw('LOWER(name) LIKE ?', [$needle])
                  ->orWhereRaw('LOWER(description) LIKE ?', [$needle]);
            });
        }

        // Filter by category slug or id
        if ($cat = $request->input('category')) {
            $query->whereHas('category', function ($q) use ($cat) {
                $q->where('slug', $cat)->orWhere('id', $cat);
            });
        }

        // Filter by brand
        if ($brandId = $request->input('brand_id')) {
            $query->where('brand_id', $brandId);
        }

        // Filter by price range
        if ($minPrice = $request->input('min_price')) {
            $query->where('price', '>=', $minPrice);
        }
        if ($maxPrice = $request->input('max_price')) {
            $query->where('price', '<=', $maxPrice);
        }

        // Sorting
        $sortBy = $request->input('sort', 'created_at');
        $sortOrder = $request->input('order', 'desc');

        if (in_array($sortBy, ['price', 'created_at', 'name'])) {
            $query->orderBy($sortBy, $sortOrder === 'asc' ? 'asc' : 'desc');
        }

        $perPage = min((int) $request->input('per_page', 12), 50);
        $products = $query->paginate($perPage);

        return response()->json($products);
    }

    /**
     * Get product details by slug or id
     */
    public function show(string $idOrSlug): JsonResponse
    {
        $product = Product::with([
            'category',
            'brand',
            'vendor',
            'images',
            'variants.stock',
            'reviews' => function ($q) {
                $q->where('status', 'approuve')->with('user:id,name');
            }
        ])
        ->where('status', ProductStatus::PUBLIE)
        ->where(function ($q) use ($idOrSlug) {
            $q->where('slug', $idOrSlug)->orWhere('id', is_numeric($idOrSlug) ? (int)$idOrSlug : 0);
        })
        ->firstOrFail();

        return response()->json([
            'product' => $product,
        ]);
    }

    /**
     * List all active categories
     */
    public function categories(): JsonResponse
    {
        $categories = Category::where('is_active', true)
            ->with('children')
            ->whereNull('parent_id')
            ->get();

        return response()->json($categories);
    }

    /**
     * List all brands
     */
    public function brands(): JsonResponse
    {
        $brands = Brand::orderBy('name')->get();

        return response()->json($brands);
    }
}
