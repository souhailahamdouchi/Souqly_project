<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Stock;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartTest extends TestCase
{
    use RefreshDatabase;

    protected $variant;

    protected function setUp(): void
    {
        parent::setUp();

        $user = $this->createUser('vendor');
        $vendor = Vendor::create([
            'user_id' => $user->id,
            'shop_name' => 'Shop',
            'status' => 'APPROUVE',
            'commission_rate' => 7.00,
        ]);
        $category = Category::create(['slug' => 'electronique', 'name_fr' => 'Électronique', 'is_active' => true]);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'category_id' => $category->id,
            'slug' => 'casque-cart-test',
            'name' => 'Casque Cart Test',
            'description' => 'Description du produit du panier.',
            'price' => 450,
            'status' => 'PUBLIE',
        ]);

        $this->variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'sku-cart-1',
            'price' => 450,
        ]);
        Stock::create(['product_variant_id' => $this->variant->id, 'quantity' => 5]);
    }

    public function test_guest_cart_via_session_header(): void
    {
        $this->withHeaders(['X-Session-Id' => 'guest-session-abc'])
            ->postJson('/api/cart/items', ['product_variant_id' => $this->variant->id, 'quantity' => 2])
            ->assertOk();

        $response = $this->withHeaders(['X-Session-Id' => 'guest-session-abc'])
            ->getJson('/api/cart');

        $response->assertOk()
            ->assertJsonPath('count', 2)
            ->assertJsonPath('total', 900);
    }

    public function test_authenticated_user_can_add_update_and_remove_an_item(): void
    {
        $user = $this->createUser('client');
        $headers = $this->authHeaders($user);

        $add = $this->postJson('/api/cart/items', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 1,
        ], $headers);
        $add->assertOk();
        $itemId = $add->json('cart_item.id');

        $this->putJson("/api/cart/items/{$itemId}", ['quantity' => 3], $headers)->assertOk();

        $cart = $this->getJson('/api/cart', $headers);
        $cart->assertOk()->assertJsonPath('count', 3)->assertJsonPath('total', 1350);

        $this->deleteJson("/api/cart/items/{$itemId}", [], $headers)->assertOk();

        $this->getJson('/api/cart', $headers)->assertJsonPath('count', 0);
    }

    public function test_adding_more_than_available_stock_is_rejected(): void
    {
        $user = $this->createUser('client');

        $response = $this->postJson('/api/cart/items', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 50,
        ], $this->authHeaders($user));

        $response->assertStatus(422)->assertJsonPath('available_stock', 5);
    }

    public function test_cart_can_be_cleared(): void
    {
        $user = $this->createUser('client');
        $headers = $this->authHeaders($user);

        $this->postJson('/api/cart/items', ['product_variant_id' => $this->variant->id], $headers)
            ->assertOk();

        $this->deleteJson('/api/cart/clear', [], $headers)->assertOk();
        $this->getJson('/api/cart', $headers)->assertJsonPath('count', 0);
    }

    public function test_unknown_variant_returns_validation_error(): void
    {
        $user = $this->createUser('client');

        $this->postJson('/api/cart/items', [
            'product_variant_id' => 999999,
            'quantity' => 1,
        ], $this->authHeaders($user))->assertStatus(422);
    }
}
