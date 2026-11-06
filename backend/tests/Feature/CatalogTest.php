<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\Stock;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function createPublishedProduct(array $overrides = []): array
    {
        $vendorUser = $this->createUser('vendor', ['name' => 'Shop Owner']);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'shop_name' => 'TechShop',
            'status' => 'APPROUVE',
            'commission_rate' => 7.00,
        ]);
        $category = Category::firstOrCreate(['slug' => 'electronique'], ['name_fr' => 'Électronique', 'is_active' => true]);
        $brand = Brand::firstOrCreate(['name' => 'Sony']);

        $product = Product::create(array_merge([
            'vendor_id' => $vendor->id,
            'category_id' => $category->id,
            'brand_id' => $brand->id,
            'slug' => 'casque-test-'.uniqid(),
            'name' => 'Casque Test',
            'description' => 'Un casque de test robuste.',
            'price' => 450.00,
            'status' => 'PUBLIE',
        ], $overrides));

        ProductImage::create(['product_id' => $product->id, 'path' => 'https://example.com/x.jpg', 'position' => 0]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'SKU-'.uniqid(),
            'price' => 450.00,
        ]);
        Stock::create(['product_variant_id' => $variant->id, 'quantity' => 10]);

        return [$product, $variant];
    }

    public function test_guest_can_browse_published_products(): void
    {
        $this->createPublishedProduct();
        $this->createPublishedProduct(['name' => 'Autre produit']);

        $response = $this->getJson('/api/catalog/products');

        $response->assertOk();
        $this->assertCount(2, $response->json('data'));
    }

    public function test_draft_products_are_hidden_from_catalog(): void
    {
        $this->createPublishedProduct();
        $this->createPublishedProduct(['status' => 'BROUILLON']);

        $response = $this->getJson('/api/catalog/products');

        $this->assertCount(1, $response->json('data'));
    }

    public function test_search_is_case_insensitive_and_portable(): void
    {
        $this->createPublishedProduct(['name' => 'Casque Audio Sans Fil Pro']);
        $this->createPublishedProduct(['name' => 'Montre Homme', 'description' => 'Une montre elegante.']);

        $response = $this->getJson('/api/catalog/products?search=casque');

        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Casque Audio Sans Fil Pro', $response->json('data.0.name'));
    }

    public function test_products_can_be_filtered_by_price_range(): void
    {
        $this->createPublishedProduct(['price' => 100]);
        $this->createPublishedProduct(['price' => 999]);

        $response = $this->getJson('/api/catalog/products?min_price=500');

        $this->assertCount(1, $response->json('data'));
        $this->assertEquals(999, $response->json('data.0.price'));
    }

    public function test_product_detail_exposes_relations(): void
    {
        [$product] = $this->createPublishedProduct();

        $response = $this->getJson('/api/catalog/products/'.$product->slug);

        $response->assertOk()
            ->assertJsonPath('product.name', 'Casque Test')
            ->assertJsonStructure(['product' => ['images', 'variants', 'vendor' => ['shop_name']]]);
        $this->assertNotNull($response->json('product.variants.0.stock'));
    }

    public function test_categories_and_brands_are_public(): void
    {
        Category::firstOrCreate(['slug' => 'mode'], ['name_fr' => 'Mode', 'is_active' => true]);
        Brand::firstOrCreate(['name' => 'Nike']);

        $this->getJson('/api/catalog/categories')->assertOk();
        $this->getJson('/api/catalog/brands')->assertOk();
    }
}
