<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\VendorStatus;
use App\Models\Address;
use App\Models\Brand;
use App\Models\Carrier;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\Role;
use App\Models\ShippingZone;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\SubOrder;
use App\Models\User;
use App\Models\Vendor;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Roles
        $roleAdmin = Role::firstOrCreate(['name' => 'admin']);
        $roleVendor = Role::firstOrCreate(['name' => 'vendor']);
        $roleSupport = Role::firstOrCreate(['name' => 'support']);
        $roleClient = Role::firstOrCreate(['name' => 'client']);
        $roleCarrier = Role::firstOrCreate(['name' => 'carrier']);

        // 2. Users
        $admin = User::firstOrCreate(
            ['email' => 'admin@souqly.ma'],
            [
                'name' => 'Youssef Admin',
                'password' => Hash::make('password123'),
                'phone' => '+212600000001',
                'locale' => 'fr',
            ]
        );
        $admin->roles()->syncWithoutDetaching([$roleAdmin->id]);

        $support = User::firstOrCreate(
            ['email' => 'support@souqly.ma'],
            [
                'name' => 'Karim Support',
                'password' => Hash::make('password123'),
                'phone' => '+212600000002',
                'locale' => 'fr',
            ]
        );
        $support->roles()->syncWithoutDetaching([$roleSupport->id]);

        $vendorUser = User::firstOrCreate(
            ['email' => 'vendor@souqly.ma'],
            [
                'name' => 'TechStore Casablanca',
                'password' => Hash::make('password123'),
                'phone' => '+212600000003',
                'locale' => 'fr',
            ]
        );
        $vendorUser->roles()->syncWithoutDetaching([$roleVendor->id]);

        $vendor = Vendor::firstOrCreate(
            ['user_id' => $vendorUser->id],
            [
                'shop_name' => 'TechStore Maroc',
                'status' => VendorStatus::APPROUVE,
                'commission_rate' => 7.00,
            ]
        );

        $client = User::firstOrCreate(
            ['email' => 'client@souqly.ma'],
            [
                'name' => 'Amine Client',
                'password' => Hash::make('password123'),
                'phone' => '+212611223344',
                'locale' => 'fr',
            ]
        );
        $client->roles()->syncWithoutDetaching([$roleClient->id]);

        $defaultAddress = Address::firstOrCreate(
            ['user_id' => $client->id, 'street' => '123 Boulevard d\'Anfa'],
            [
                'city' => 'Casablanca',
                'phone' => '+212611223344',
                'is_default' => true,
            ]
        );

        // 3. Shipping Zones & Carriers
        $zoneCasa = ShippingZone::firstOrCreate(['city' => 'Casablanca'], ['fee' => 20.00]);
        $zoneRabat = ShippingZone::firstOrCreate(['city' => 'Rabat'], ['fee' => 25.00]);
        $zoneMarrakech = ShippingZone::firstOrCreate(['city' => 'Marrakech'], ['fee' => 35.00]);
        $zoneTanger = ShippingZone::firstOrCreate(['city' => 'Tanger'], ['fee' => 35.00]);

        $carrierAmana = Carrier::firstOrCreate(['name' => 'Amana Express']);
        $carrierAramex = Carrier::firstOrCreate(['name' => 'Aramex Maroc']);

        // 4. Categories
        $catElectro = Category::firstOrCreate(
            ['slug' => 'electronique'],
            ['name_fr' => 'Électronique', 'name_ar' => 'إلكترونيات', 'is_active' => true]
        );
        $catMode = Category::firstOrCreate(
            ['slug' => 'mode'],
            ['name_fr' => 'Mode & Vêtements', 'name_ar' => 'أزياء وملابس', 'is_active' => true]
        );
        $catMaison = Category::firstOrCreate(
            ['slug' => 'maison-cuisine'],
            ['name_fr' => 'Maison & Cuisine', 'name_ar' => 'المنزل والمطبخ', 'is_active' => true]
        );

        // 5. Brands
        $brandSony = Brand::firstOrCreate(['name' => 'Sony']);
        $brandApple = Brand::firstOrCreate(['name' => 'Apple']);
        $brandNike = Brand::firstOrCreate(['name' => 'Nike']);

        // 6. Products matching the frontend mockup
        // Product 1
        $prod1 = Product::firstOrCreate(
            ['slug' => 'casque-audio-sans-fil'],
            [
                'vendor_id' => $vendor->id,
                'category_id' => $catElectro->id,
                'brand_id' => $brandSony->id,
                'name' => 'Casque Audio Sans Fil Pro',
                'price' => 450.00,
                'promo_price' => 399.00,
                'status' => ProductStatus::PUBLIE,
                'description' => 'Casque audio circum-aural Bluetooth avec réduction active de bruit.',
            ]
        );
        ProductImage::firstOrCreate(
            ['product_id' => $prod1->id, 'path' => 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80'],
            ['position' => 0]
        );
        $var1 = ProductVariant::firstOrCreate(
            ['sku' => 'CAS-SND-01'],
            ['product_id' => $prod1->id, 'size' => 'Standard', 'color' => 'Noir', 'price' => 450.00]
        );
        $stock1 = Stock::firstOrCreate(
            ['product_variant_id' => $var1->id],
            ['quantity' => 15, 'low_threshold' => 5]
        );
        StockMovement::firstOrCreate(
            ['stock_id' => $stock1->id, 'delta' => 15, 'reason' => 'Stock initial']
        );

        // Product 2
        $prod2 = Product::firstOrCreate(
            ['slug' => 'montre-elegante-homme'],
            [
                'vendor_id' => $vendor->id,
                'category_id' => $catMode->id,
                'brand_id' => $brandApple->id,
                'name' => 'Montre Élégante pour Homme',
                'price' => 299.00,
                'promo_price' => null,
                'status' => ProductStatus::PUBLIE,
                'description' => 'Montre classique en acier inoxydable avec bracelet en cuir véritable.',
            ]
        );
        ProductImage::firstOrCreate(
            ['product_id' => $prod2->id, 'path' => 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'],
            ['position' => 0]
        );
        $var2 = ProductVariant::firstOrCreate(
            ['sku' => 'MON-ELEG-01'],
            ['product_id' => $prod2->id, 'size' => 'Unique', 'color' => 'Argent', 'price' => 299.00]
        );
        $stock2 = Stock::firstOrCreate(
            ['product_variant_id' => $var2->id],
            ['quantity' => 8, 'low_threshold' => 3]
        );
        StockMovement::firstOrCreate(
            ['stock_id' => $stock2->id, 'delta' => 8, 'reason' => 'Stock initial']
        );

        // Product 3
        $prod3 = Product::firstOrCreate(
            ['slug' => 'baskets-de-sport-rouge'],
            [
                'vendor_id' => $vendor->id,
                'category_id' => $catMode->id,
                'brand_id' => $brandNike->id,
                'name' => 'Baskets de Sport Rouge',
                'price' => 850.00,
                'promo_price' => 750.00,
                'status' => ProductStatus::PUBLIE,
                'description' => 'Baskets de running haute performance avec semelle amortissante.',
            ]
        );
        ProductImage::firstOrCreate(
            ['product_id' => $prod3->id, 'path' => 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80'],
            ['position' => 0]
        );
        $var3 = ProductVariant::firstOrCreate(
            ['sku' => 'BSK-RED-42'],
            ['product_id' => $prod3->id, 'size' => '42', 'color' => 'Rouge', 'price' => 850.00]
        );
        $stock3 = Stock::firstOrCreate(
            ['product_variant_id' => $var3->id],
            ['quantity' => 12, 'low_threshold' => 4]
        );
        StockMovement::firstOrCreate(
            ['stock_id' => $stock3->id, 'delta' => 12, 'reason' => 'Stock initial']
        );

        // 7. Coupons
        Coupon::firstOrCreate(
            ['code' => 'BIENVENUE10'],
            [
                'type' => 'percentage',
                'value' => 10.00,
                'starts_at' => Carbon::today(),
                'expires_at' => Carbon::today()->addYear(),
                'quota' => 500,
                'per_user_limit' => 1,
            ]
        );

        Coupon::firstOrCreate(
            ['code' => 'SOUQLY50'],
            [
                'type' => 'fixed',
                'value' => 50.00,
                'starts_at' => Carbon::today(),
                'expires_at' => Carbon::today()->addYear(),
                'quota' => 200,
                'per_user_limit' => 1,
            ]
        );

        // 8. Sample Order for client
        $sampleOrder = Order::firstOrCreate(
            ['number' => 'ORD-2026-0001'],
            [
                'user_id' => $client->id,
                'shipping_address_id' => $defaultAddress->id,
                'shipping_zone_id' => $zoneCasa->id,
                'subtotal' => 450.00,
                'shipping_fee' => 20.00,
                'discount' => 0.00,
                'total' => 470.00,
                'status' => OrderStatus::CONFIRMEE,
            ]
        );

        $subOrder = SubOrder::firstOrCreate(
            ['order_id' => $sampleOrder->id, 'vendor_id' => $vendor->id],
            [
                'subtotal' => 450.00,
                'status' => OrderStatus::CONFIRMEE,
            ]
        );

        OrderItem::firstOrCreate(
            ['sub_order_id' => $subOrder->id, 'sku' => 'CAS-SND-01'],
            [
                'product_variant_id' => $var1->id,
                'quantity' => 1,
                'product_name' => 'Casque Audio Sans Fil Pro',
                'unit_price' => 450.00,
                'commission_rate' => 7.00,
            ]
        );

        OrderStatusHistory::firstOrCreate(
            ['order_id' => $sampleOrder->id, 'to_status' => OrderStatus::CONFIRMEE->value],
            [
                'from_status' => OrderStatus::EN_ATTENTE->value,
                'created_at' => Carbon::now(),
            ]
        );

        Payment::firstOrCreate(
            ['order_id' => $sampleOrder->id],
            [
                'method' => 'cash_on_delivery',
                'status' => PaymentStatus::EN_ATTENTE,
                'amount' => 470.00,
                'provider_ref' => 'COD-ORD-0001',
            ]
        );
    }
}
