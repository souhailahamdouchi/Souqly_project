<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingZone;
use App\Models\Stock;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected $user;
    protected $vendor;
    protected $address;
    protected $variant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = $this->createUser('client');
        $this->address = Address::create([
            'user_id' => $this->user->id,
            'city' => 'Casablanca',
            'street' => '12 Rue Zerktouni',
            'phone' => '+212661122334',
            'is_default' => true,
        ]);

        ShippingZone::create(['city' => 'Casablanca', 'fee' => 20]);
        ShippingZone::create(['city' => 'Marrakech', 'fee' => 35]);

        $vendorUser = $this->createUser('vendor');
        $this->vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'shop_name' => 'TechShop',
            'status' => 'APPROUVE',
            'commission_rate' => 7.00,
        ]);

        $category = Category::create(['slug' => 'electronique', 'name_fr' => 'Électronique', 'is_active' => true]);
        $brand = Brand::create(['name' => 'Sony']);

        $product = Product::create([
            'vendor_id' => $this->vendor->id,
            'category_id' => $category->id,
            'brand_id' => $brand->id,
            'slug' => 'casque-checkout-test',
            'name' => 'Casque Checkout Test',
            'description' => 'Description du produit de test suffisamment longue.',
            'price' => 450,
            'status' => 'PUBLIE',
        ]);

        $this->variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => 'sku-checkout-1',
            'price' => 450,
        ]);
        Stock::create(['product_variant_id' => $this->variant->id, 'quantity' => 10]);
    }

    protected function addVariantToCart(int $quantity = 1): CartItem
    {
        $cart = Cart::firstOrCreate(['user_id' => $this->user->id]);

        return CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $this->variant->id,
            'quantity' => $quantity,
        ]);
    }

    protected function createCoupon(string $type = 'percentage', float $value = 10): Coupon
    {
        return Coupon::create([
            'code' => 'TEST'.strtoupper(uniqid()),
            'type' => $type,
            'value' => $value,
            'starts_at' => now(),
            'expires_at' => now()->addYear(),
            'quota' => 100,
            'per_user_limit' => 1,
        ]);
    }

    public function test_shipping_zones_are_public(): void
    {
        $response = $this->getJson('/api/checkout/shipping-zones');

        $response->assertOk()
            ->assertJsonFragment(['city' => 'Casablanca', 'fee' => '20.00']);
    }

    public function test_verify_stock_reports_valid_cart(): void
    {
        $this->addVariantToCart(2);

        $response = $this->getJson('/api/checkout/verify-stock', $this->authHeaders($this->user));

        $response->assertOk()->assertJsonPath('valid', true);
    }

    public function test_verify_stock_reports_missing_quantity(): void
    {
        $this->addVariantToCart(99);

        $response = $this->getJson('/api/checkout/verify-stock', $this->authHeaders($this->user));

        $response->assertStatus(422)->assertJsonPath('valid', false);
    }

    public function test_percentage_coupon_is_applied_server_side(): void
    {
        $coupon = $this->createCoupon('percentage', 10);

        $response = $this->postJson('/api/checkout/apply-coupon', [
            'code' => $coupon->code,
            'subtotal' => 450,
        ]);

        $response->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonPath('discount', 45)
            ->assertJsonPath('new_total', 405);
    }

    public function test_unknown_coupon_is_rejected(): void
    {
        $response = $this->postJson('/api/checkout/apply-coupon', [
            'code' => 'DOES_NOT_EXIST',
            'subtotal' => 450,
        ]);

        $response->assertJsonPath('valid', false);
    }

    public function test_place_order_with_cash_on_delivery(): void
    {
        $this->addVariantToCart(2);

        $response = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'cash_on_delivery',
        ], $this->authHeaders($this->user));

        $response->assertCreated()
            ->assertJsonPath('order.subtotal', '900.00')
            ->assertJsonPath('order.shipping_fee', '20.00')
            ->assertJsonPath('order.total', '920.00');

        $orderId = $response->json('order.id');
        $this->assertDatabaseHas('orders', ['id' => $orderId, 'status' => 'EN_ATTENTE']);
        $this->assertDatabaseHas('sub_orders', ['order_id' => $orderId, 'vendor_id' => $this->vendor->id]);
        $this->assertDatabaseHas('commissions', [
            'vendor_id' => $this->vendor->id,
            'amount' => 63.0, // 7% of 900
            'status' => 'EN_ATTENTE',
            'sub_order_id' => $response->json('order.sub_orders.0.id'),
        ]);
        $this->assertDatabaseHas('payments', [
            'order_id' => $orderId,
            'method' => 'cash_on_delivery',
            'amount' => 920,
        ]);

        // Stock decremented (RM-003)
        $this->assertSame(8, $this->variant->stock->fresh()->quantity);

        // Cart emptied
        $this->assertSame(
            0,
            CartItem::where('cart_id', Cart::where('user_id', $this->user->id)->first()->id)->count()
        );
    }

    public function test_place_order_rejects_empty_cart(): void
    {
        $response = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'cash_on_delivery',
        ], $this->authHeaders($this->user));

        $response->assertStatus(400);
    }

    public function test_place_order_rejects_other_users_address(): void
    {
        $this->addVariantToCart(1);
        $intruder = $this->createUser('client');
        $foreignAddress = Address::create([
            'user_id' => $intruder->id,
            'city' => 'Rabat',
            'street' => '1 Rue Autre',
            'phone' => '+212600000000',
        ]);

        $response = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $foreignAddress->id,
            'payment_method' => 'cash_on_delivery',
        ], $this->authHeaders($this->user));

        $response->assertStatus(422);
    }

    public function test_idempotency_key_prevents_duplicate_orders(): void
    {
        $this->addVariantToCart(1);

        $payload = [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'cash_on_delivery',
            'idempotency_key' => 'unique-key-42',
        ];

        $first = $this->postJson('/api/checkout/place-order', $payload, $this->authHeaders($this->user));
        $second = $this->postJson('/api/checkout/place-order', $payload, $this->authHeaders($this->user));

        $first->assertCreated();
        $second->assertOk();

        $this->assertSame($first->json('order.id'), $second->json('order.id'));
    }

    public function test_webhook_confirms_card_payment_and_marks_commission_due(): void
    {
        $this->addVariantToCart(1);

        $orderData = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'card',
        ], $this->authHeaders($this->user))->assertCreated()->json('order');

        $payment = Payment::where('order_id', $orderData['id'])->firstOrFail();

        $payload = json_encode([
            'provider_ref' => $payment->provider_ref,
            'status' => 'success',
        ]);
        $signature = hash_hmac('sha256', $payload, (string) env('PAYMENT_WEBHOOK_SECRET'));

        $response = $this->postJson(
            '/api/payments/webhook',
            json_decode($payload, true),
            ['X-Signature' => $signature]
        );

        $response->assertOk()->assertJsonPath('payment_status', 'PAYE');

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'PAYE']);
        $this->assertDatabaseHas('orders', ['id' => $orderData['id'], 'status' => 'CONFIRMEE']);
        $this->assertDatabaseHas('commissions', ['sub_order_id' => $orderData['sub_orders'][0]['id'], 'status' => 'DUE']);
    }

    public function test_webhook_rejects_invalid_signature(): void
    {
        $this->addVariantToCart(1);

        $orderData = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'card',
        ], $this->authHeaders($this->user))->assertCreated()->json('order');

        $providerRef = Payment::where('order_id', $orderData['id'])->value('provider_ref');

        $response = $this->postJson('/api/payments/webhook', [
            'provider_ref' => $providerRef,
            'status' => 'success',
        ], ['X-Signature' => 'tampered-signature']);

        $response->assertStatus(403);
    }

    public function test_webhook_failure_cancels_card_order(): void
    {
        $this->addVariantToCart(1);

        $orderData = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'card',
        ], $this->authHeaders($this->user))->assertCreated()->json('order');

        $this->assertSame(9, $this->variant->stock->fresh()->quantity);

        $providerRef = Payment::where('order_id', $orderData['id'])->value('provider_ref');
        $payload = json_encode([
            'provider_ref' => $providerRef,
            'status' => 'failed',
        ]);
        $signature = hash_hmac('sha256', $payload, (string) env('PAYMENT_WEBHOOK_SECRET'));

        $response = $this->postJson(
            '/api/payments/webhook',
            json_decode($payload, true),
            ['X-Signature' => $signature]
        );

        $response->assertOk()->assertJsonPath('payment_status', 'ECHOUE');
        $this->assertDatabaseHas('orders', ['id' => $orderData['id'], 'status' => 'ANNULEE']);

        // Stock restored after failure (DS rule)
        $this->assertSame(10, $this->variant->stock->fresh()->quantity);
    }

    public function test_coupon_usage_is_recorded_and_per_user_limit_enforced(): void
    {
        $coupon = $this->createCoupon('percentage', 10);
        $this->addVariantToCart(1);

        $response = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'cash_on_delivery',
            'coupon_code' => $coupon->code,
        ], $this->authHeaders($this->user));

        $response->assertCreated()->assertJsonPath('order.discount', '45.00');

        $this->assertDatabaseHas('coupon_usages', [
            'coupon_id' => $coupon->id,
            'user_id' => $this->user->id,
        ]);

        // Second attempt: per_user_limit = 1 so the coupon no longer applies
        $this->addVariantToCart(1);

        $second = $this->postJson('/api/checkout/place-order', [
            'shipping_address_id' => $this->address->id,
            'payment_method' => 'cash_on_delivery',
            'coupon_code' => $coupon->code,
        ], $this->authHeaders($this->user));

        $second->assertCreated()->assertJsonPath('order.discount', '0.00');
    }
}
