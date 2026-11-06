<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Brand;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CartTestNoop;
use App\Models\Category;
use App\Models\Notification;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Stock;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientFlowsTest extends TestCase
{
    use RefreshDatabase;

    protected $client;
    protected $vendor;
    protected $vendorUser;
    protected $product;
    protected $variant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = $this->createUser('client');
        $this->vendorUser = $this->createUser('vendor');
        $this->vendor = Vendor::create([
            'user_id' => $this->vendorUser->id,
            'shop_name' => 'Shop',
            'status' => 'APPROUVE',
            'commission_rate' => 7.00,
        ]);
        $category = Category::create(['slug' => 'cat-flows-'.uniqid(), 'name_fr' => 'Cat', 'is_active' => true]);

        $this->product = Product::create([
            'vendor_id' => $this->vendor->id,
            'category_id' => $category->id,
            'slug' => 'prod-flows-'.uniqid(),
            'name' => 'Produit Flows',
            'description' => 'Description du produit flows suffisante.',
            'price' => 200,
            'status' => 'PUBLIE',
        ]);
        $this->variant = ProductVariant::create([
            'product_id' => $this->product->id,
            'sku' => 'sku-flows-'.uniqid(),
            'price' => 200,
        ]);
        Stock::create(['product_variant_id' => $this->variant->id, 'quantity' => 10]);
    }

    protected function placeOrder(string $method = 'cash_on_delivery'): array
    {
        $address = Address::create([
            'user_id' => $this->client->id,
            'city' => 'Casablanca',
            'street' => '12 Rue',
            'phone' => '+212600112233',
        ]);
        $cart = Cart::firstOrCreate(['user_id' => $this->client->id]);
        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => 1,
        ]);

        return $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $address->id,
            'payment_method' => $method,
        ], $this->authHeaders($this->client))->assertCreated()->json('order');
    }

    public function test_orders_listing_and_cancel(): void
    {
        $order = $this->placeOrder();

        $headers = $this->authHeaders($this->client);
        $this->getJson('/api/orders', $headers)->assertOk()->assertJsonPath('data.0.id', $order['id']);

        $cancel = $this->postJson("/api/orders/{$order['id']}/cancel", [], $headers);
        $cancel->assertOk();

        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'status' => 'ANNULEE']);

        // Stock restored on cancel
        $this->assertSame(10, $this->variant->stock->fresh()->quantity);
    }

    protected function shipSubOrder(int $subOrderId): void
    {
        $this->switchAuth($this->vendorUser);
        $this->putJson("/api/vendor/orders/{$subOrderId}/status", ['status' => 'CONFIRMEE'])->assertOk();

        // Mark payment as COD pending delivery: simulate vendor preparing -> carrier shipping
        $shipmentId = \App\Models\Carrier::create(['name' => 'Amana Express'])->id;
        $this->putJson("/api/vendor/orders/{$subOrderId}/status", [
            'status' => 'EXPEDIEE',
            'carrier_id' => $shipmentId,
            'tracking_number' => 'TRACK-CANCEL-1',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
    }

    public function test_cannot_cancel_shipped_order(): void
    {
        $order = $this->placeOrder();
        $subOrderId = $order['sub_orders'][0]['id'];

        $this->shipSubOrder($subOrderId);

        $response = $this->postJson("/api/orders/{$order['id']}/cancel", [], $this->authHeaders($this->client));

        $response->assertStatus(422);
        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'status' => 'EXPEDIEE']);
    }

    public function test_review_flow_restricts_duplicates(): void
    {
        $headers = $this->authHeaders($this->client);

        $this->postJson('/api/reviews', [
            'product_id' => $this->product->id,
            'rating' => 5,
            'comment' => 'Excellent produit vraiment.',
        ], $headers)->assertCreated();

        $this->assertDatabaseHas('reviews', [
            'product_id' => $this->product->id,
            'user_id' => $this->client->id,
             'status' => 'en_attente',
        ]);

        // Duplicate review for same product by same user -> 422
        $this->postJson('/api/reviews', [
            'product_id' => $this->product->id,
            'rating' => 1,
            'comment' => 'Second commentaire.',
        ], $headers)->assertStatus(422);
    }

    public function test_wishlist_toggle(): void
    {
        $headers = $this->authHeaders($this->client);

        $add = $this->postJson("/api/wishlist/{$this->product->id}/toggle", [], $headers);
        $add->assertCreated()->assertJsonPath('in_wishlist', true);

        $list = $this->getJson('/api/wishlist', $headers);
        $list->assertOk();
        $this->assertCount(1, $list->json());

        $remove = $this->postJson("/api/wishlist/{$this->product->id}/toggle", [], $headers);
        $remove->assertOk()->assertJsonPath('in_wishlist', false);
    }

    public function test_complaint_creation_and_support_resolution(): void
    {
        $order = $this->placeOrder();
        $headers = $this->authHeaders($this->client);

        $complaint = $this->postJson('/api/complaints', [
            'order_id' => $order['id'],
            'subject' => 'Article endommagé',
            'description' => 'Le colis est arrivé avec un cordon cassé.',
        ], $headers);

        $complaint->assertCreated()->assertJsonPath('complaint.status', 'ouverte');

        $support = $this->createUser('support');
        $this->switchAuth($support);
        $this->putJson("/api/support/complaints/{$complaint->json('complaint.id')}", [
            'status' => 'resolue',
        ])->assertOk();

        $this->assertDatabaseHas('complaints', ['id' => $complaint->json('complaint.id'), 'status' => 'resolue']);

        $this->getJson('/api/complaints/my', $headers)->assertOk();
    }

    public function test_notifications_listing_and_mark_read(): void
    {
        $order = $this->placeOrder();
        $headers = $this->authHeaders($this->client);

        $list = $this->getJson('/api/notifications', $headers);
        $list->assertOk();
        $this->assertGreaterThan(0, $list->json('unread_count'));

        $id = $list->json('notifications.0.id');

        $this->putJson("/api/notifications/{$id}/read", [], $headers)->assertOk();
        $this->assertDatabaseMissing('notifications', ['id' => $id, 'read_at' => null]);
    }
}
