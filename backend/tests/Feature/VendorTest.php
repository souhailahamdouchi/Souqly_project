<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Brand;
use App\Models\Carrier;
use App\Models\Category;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Payment;
use App\Models\ShippingZone;
use App\Models\Vendor;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorTest extends TestCase
{
    use RefreshDatabase;

    protected $vendor;
    protected $vendorUser;
    protected $client;
    protected $category;
    protected $brand;
    protected $subOrderId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vendorUser = $this->createUser('vendor');
        $this->vendor = Vendor::create([
            'user_id' => $this->vendorUser->id,
            'shop_name' => 'TechShop',
            'status' => 'APPROUVE',
            'commission_rate' => 7.00,
        ]);
        $this->client = $this->createUser('client');
        $this->category = Category::create(['slug' => 'electronique', 'name_fr' => 'Électronique', 'is_active' => true]);
        $this->brand = Brand::create(['name' => 'Sony']);
        ShippingZone::create(['city' => 'Casablanca', 'fee' => 20]);
        Carrier::create(['name' => 'Amana Express']);
    }

    protected function placeClientOrder(int $quantity = 1): array
    {
        $product = \App\Models\Product::create([
            'vendor_id' => $this->vendor->id,
            'category_id' => $this->category->id,
            'brand_id' => $this->brand->id,
            'slug' => 'vendor-order-test-'.uniqid(),
            'name' => 'Produit Vendeur',
            'description' => 'Description du produit vendeur suffisante.',
            'price' => 450,
            'status' => 'PUBLIE',
        ]);
        $variant = \App\Models\ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'sku-vendor-'.uniqid(),
            'price' => 450,
        ]);
        \App\Models\Stock::create(['product_variant_id' => $variant->id, 'quantity' => 10]);

        $address = Address::create([
            'user_id' => $this->client->id,
            'city' => 'Casablanca',
            'street' => '12 Rue',
            'phone' => '+212600112233',
        ]);

        $cart = Cart::firstOrCreate(['user_id' => $this->client->id]);
        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => $quantity,
        ]);

        $order = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $address->id,
            'payment_method' => 'cash_on_delivery',
        ], $this->authHeaders($this->client))->assertCreated()->json('order');

        return [$order, $product, $variant];
    }

    public function test_vendor_can_create_a_draft_product_with_variants(): void
    {
        $response = $this->postJson('/api/vendor/products', [
            'name' => 'Nouveau Produit Vendeur',
            'description' => 'Une description d\'au moins dix caractères.',
            'category_id' => $this->category->id,
            'price' => 399,
            'variants' => [
                ['sku' => 'SKU-NEW-1', 'size' => 'Standard', 'color' => 'Noir', 'price' => 399, 'stock' => 12],
            ],
            'images' => [
                ['path' => 'https://example.com/img.jpg'],
            ],
        ], $this->authHeaders($this->vendorUser));

        $response->assertCreated()->assertJsonPath('product.status', 'BROUILLON');
        $this->assertDatabaseHas('product_variants', ['sku' => 'SKU-NEW-1']);
        $this->assertDatabaseHas('stocks', [
            'product_variant_id' => $response->json('product.variants.0.id'),
        ]);
    }

    public function test_pending_vendor_cannot_create_products(): void
    {
        $this->vendor->update(['status' => 'EN_ATTENTE']);

        $response = $this->postJson('/api/vendor/products', [
            'name' => 'Produit Refuse',
            'description' => 'Une description d\'au moins dix caractères.',
            'category_id' => $this->category->id,
            'price' => 399,
            'variants' => [
                ['sku' => 'SKU-DENIED', 'size' => 'S', 'color' => 'Noir', 'price' => 399],
            ],
        ], $this->authHeaders($this->vendorUser));

        $response->assertStatus(403);
    }

    public function test_product_submission_moves_to_en_attente(): void
    {
        $productId = $this->postJson('/api/vendor/products', [
            'name' => 'Produit Soumission',
            'description' => 'Une description d\'au moins dix caractères.',
            'category_id' => $this->category->id,
            'price' => 499,
            'variants' => [
                ['sku' => 'SKU-SUB-1', 'size' => 'S', 'color' => 'Blanc', 'price' => 499, 'stock' => 7],
            ],
        ], $this->authHeaders($this->vendorUser))->assertCreated()->json('product.id');

        $response = $this->postJson("/api/vendor/products/{$productId}/submit", [], $this->authHeaders($this->vendorUser));

        $response->assertOk()->assertJsonPath('product.status', 'EN_ATTENTE');
    }

    public function test_vendor_cannot_touch_other_vendor_products(): void
    {
        $otherUser = $this->createUser('vendor');
        $otherVendor = Vendor::create([
            'user_id' => $otherUser->id,
            'shop_name' => 'Rival Shop',
            'status' => 'APPROUVE',
            'commission_rate' => 7.00,
        ]);
        $product = \App\Models\Product::create([
            'vendor_id' => $otherVendor->id,
            'category_id' => $this->category->id,
            'slug' => 'rival-product',
            'name' => 'Produit Rival',
            'description' => 'Description du produit rival suffisante.',
            'price' => 50,
            'status' => 'BROUILLON',
        ]);

        $this->deleteJson("/api/vendor/products/{$product->id}", [], $this->authHeaders($this->vendorUser))
            ->assertStatus(404);
    }

    public function test_vendor_sees_only_own_sub_orders(): void
    {
        [$order] = $this->placeClientOrder(1);

        $response = $this->switchAuth($this->vendorUser)->getJson('/api/vendor/orders');

        $response->assertOk();
        $this->assertContains($order['sub_orders'][0]['id'], collect($response->json('data'))->pluck('id')->all());
    }

    public function test_vendor_updates_sub_order_status_and_shipment_created(): void
    {
        [$order] = $this->placeClientOrder(1);
        $subOrderId = $order['sub_orders'][0]['id'];
        $this->switchAuth($this->vendorUser);
        $carrier = Carrier::first();

        $this->putJson("/api/vendor/orders/{$subOrderId}/status", ['status' => 'CONFIRMEE'])->assertOk();
        $this->assertDatabaseHas('sub_orders', ['id' => $subOrderId, 'status' => 'CONFIRMEE']);

        $response = $this->putJson("/api/vendor/orders/{$subOrderId}/status", [
            'status' => 'EXPEDIEE',
            'carrier_id' => $carrier->id,
            'tracking_number' => 'AMANA-TEST-123',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('shipments', [
            'sub_order_id' => $subOrderId,
            'carrier_id' => $carrier->id,
            'tracking_number' => 'AMANA-TEST-123',
        ]);

        // Public tracking endpoint resolves it
        $this->getJson('/api/shipments/track/AMANA-TEST-123')
            ->assertOk()
            ->assertJsonPath('carrier', 'Amana Express');
    }

    public function test_expediee_requires_carrier_and_tracking(): void
    {
        [$order] = $this->placeClientOrder(1);
        $subOrderId = $order['sub_orders'][0]['id'];

        $response = $this->switchAuth($this->vendorUser)->putJson("/api/vendor/orders/{$subOrderId}/status", ['status' => 'EXPEDIEE']);

        $response->assertStatus(422);
    }

    public function test_stock_update_never_goes_negative_and_moves_are_traced(): void
    {
        [$order, $product, $variant] = $this->placeClientOrder(1);
        $stock = \App\Models\Stock::where('product_variant_id', $variant->id)->firstOrFail();

        $this->switchAuth($this->vendorUser)
            ->putJson("/api/vendor/stocks/{$stock->id}", ['delta' => 5, 'reason' => 'Réassort fournisseur'])
            ->assertOk();

        $this->assertDatabaseHas('stock_movements', ['stock_id' => $stock->id, 'delta' => 5]);
        $this->assertSame(14, $stock->fresh()->quantity); // 10 initial, 1 sold, +5 restock

        $this->putJson("/api/vendor/stocks/{$stock->id}", ['delta' => -50])->assertStatus(422);
        $this->assertSame(14, $stock->fresh()->quantity);
    }

    public function test_sales_dashboard_returns_kpis(): void
    {
        [$order] = $this->placeClientOrder(2);
        $subOrderId = $order['sub_orders'][0]['id'];
        $this->switchAuth($this->vendorUser);
        $this->putJson("/api/vendor/orders/{$subOrderId}/status", ['status' => 'CONFIRMEE'])->assertOk();

        $response = $this->getJson('/api/vendor/sales/dashboard');
        $response->assertOk()
            ->assertJsonStructure([
                'kpis' => ['total_sales', 'total_commissions', 'net_earnings', 'total_orders'],
            ]);

        $this->assertSame(900.0, (float) $response->json('kpis.total_sales'));
    }
}
