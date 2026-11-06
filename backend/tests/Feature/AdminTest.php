<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Review;
use App\Models\Stock;
use App\Models\Vendor;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;
    protected $vendor;
    protected $vendorUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->createUser('admin');
        $this->vendorUser = $this->createUser('vendor');
        $this->vendor = Vendor::create([
            'user_id' => $this->vendorUser->id,
            'shop_name' => 'Shop To Moderate',
            'status' => 'EN_ATTENTE',
            'commission_rate' => 7.00,
        ]);
    }

    protected function createProduct(string $status = 'EN_ATTENTE'): Product
    {
        $category = Category::create(['slug' => 'cat-'.uniqid(), 'name_fr' => 'Catégorie', 'is_active' => true]);
        $brand = Brand::create(['name' => 'Brand '.uniqid()]);

        $product = Product::create([
            'vendor_id' => $this->vendor->id,
            'category_id' => $category->id,
            'brand_id' => $brand->id,
            'slug' => 'prod-'.uniqid(),
            'name' => 'Produit Modéré',
            'description' => 'Description du produit modéré suffisante.',
            'price' => 100,
            'status' => $status,
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'sku-admin-'.uniqid(),
            'price' => 100,
        ]);
        Stock::create(['product_variant_id' => $variant->id, 'quantity' => 10]);

        return $product;
    }

    protected function createPendingReview(): Review
    {
        $product = $this->createProduct('PUBLIE');
        $client = $this->createUser('client');

        return Review::create([
            'product_id' => $product->id,
            'user_id' => $client->id,
            'rating' => 4,
            'comment' => 'Très bon produit, livraison rapide.',
            'status' => 'en_attente',
            'is_verified' => false,
        ]);
    }

    public function test_admin_dashboard_stats_are_consolidated(): void
    {
        $response = $this->getJson('/api/admin/dashboard/stats', $this->authHeaders($this->admin));

        $response->assertOk()
            ->assertJsonStructure([
                'metrics' => ['total_orders', 'total_users', 'pending_reviews', 'open_complaints'],
            ]);
    }

    public function test_admin_can_approve_vendor(): void
    {
        $response = $this->putJson("/api/admin/vendors/{$this->vendor->id}/approve", [], $this->authHeaders($this->admin));

        $response->assertOk();
        $this->assertDatabaseHas('vendors', ['id' => $this->vendor->id, 'status' => 'APPROUVE']);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'APPROVE_VENDOR',
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_admin_can_suspend_vendor(): void
    {
        $response = $this->putJson("/api/admin/vendors/{$this->vendor->id}/suspend", [], $this->authHeaders($this->admin));

        $response->assertOk();
        $this->assertDatabaseHas('vendors', ['id' => $this->vendor->id, 'status' => 'SUSPENDU']);
    }

    public function test_non_admin_cannot_access_admin_routes(): void
    {
        $client = $this->createUser('client');

        $this->getJson('/api/admin/dashboard/stats', $this->authHeaders($client))->assertStatus(403);
        $this->putJson("/api/admin/vendors/{$this->vendor->id}/approve", [], $this->authHeaders($client))->assertStatus(403);
    }

    public function test_admin_can_list_and_validate_pending_products(): void
    {
        $product = $this->createProduct('EN_ATTENTE');
        $headers = $this->authHeaders($this->admin);

        $pending = $this->getJson('/api/admin/products/pending', $headers);
        $pending->assertOk();
        $this->assertContains($product->id, collect($pending->json('data'))->pluck('id')->all());

        $this->putJson("/api/admin/products/{$product->id}/validate", [], $headers)->assertOk();
        $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'PUBLIE']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'VALIDATE_PRODUCT']);
    }

    public function test_admin_can_reject_product(): void
    {
        $product = $this->createProduct('EN_ATTENTE');

        $this->putJson("/api/admin/products/{$product->id}/reject", [], $this->authHeaders($this->admin))->assertOk();
        $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'REFUSE']);
    }

    public function test_admin_can_moderate_reviews(): void
    {
        $review = $this->createPendingReview();
        $headers = $this->authHeaders($this->admin);

        $this->getJson('/api/admin/reviews/pending', $headers)
            ->assertOk()
            ->assertJsonPath('data.0.id', $review->id);

        $this->putJson("/api/admin/reviews/{$review->id}/approve", [], $headers)->assertOk();
        $this->assertDatabaseHas('reviews', ['id' => $review->id, 'status' => 'approuve']);
    }

    public function test_admin_can_manage_coupons(): void
    {
        $headers = $this->authHeaders($this->admin);

        $create = $this->postJson('/api/admin/coupons', [
            'code' => 'ADMIN10',
            'type' => 'percentage',
            'value' => 10,
            'starts_at' => now()->toDateString(),
            'expires_at' => now()->addYear()->toDateString(),
            'quota' => 50,
        ], $headers);

        $create->assertCreated();
        $this->assertDatabaseHas('coupons', ['code' => 'ADMIN10', 'type' => 'percentage']);

        $update = $this->putJson("/api/admin/coupons/{$create->json('coupon.id')}", ['value' => 20], $headers);
        $update->assertOk()->assertJsonPath('coupon.value', '20.00');

        $this->deleteJson("/api/admin/coupons/{$create->json('coupon.id')}", [], $headers)->assertOk();
        $this->assertDatabaseMissing('coupons', ['code' => 'ADMIN10']);
    }

    public function test_commission_payout_flow(): void
    {
        $product = $this->createProduct('PUBLIE');
        $variant = ProductVariant::where('product_id', $product->id)->firstOrFail();

        // A real client order creates a commission of 7% of the sub-order subtotal
        $client = $this->createUser('client');
        \App\Models\Cart::firstOrCreate(['user_id' => $client->id])->items()->create([
            'product_variant_id' => $variant->id,
            'quantity' => 1,
        ]);

        $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => \App\Models\Address::create([
                'user_id' => $client->id,
                'city' => 'Casablanca',
                'street' => '12 Rue',
                'phone' => '+212600112233',
            ])->id,
            'payment_method' => 'cash_on_delivery',
        ], $this->authHeaders($client))->assertCreated();

        $this->assertDatabaseHas('commissions', [
            'vendor_id' => $this->vendor->id,
            'amount' => '7.00',
            'status' => 'EN_ATTENTE',
        ]);

        $payout = $this->switchAuth($this->admin)->postJson("/api/admin/vendors/{$this->vendor->id}/payout", [
            'period_start' => now()->subDay()->toDateString(),
            'period_end' => now()->addDay()->toDateString(),
        ]);

        $payout->assertCreated();
        $this->assertDatabaseHas('payouts', [
            'vendor_id' => $this->vendor->id,
            'status' => 'VERSE',
            'commission_total' => '7.00',
        ]);
        $this->assertDatabaseHas('commissions', [
            'vendor_id' => $this->vendor->id,
            'status' => 'VERSEE',
        ]);
    }
}
