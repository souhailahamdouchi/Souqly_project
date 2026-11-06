<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shipping_address_id')->nullable()->constrained('addresses')->nullOnDelete();
            $table->foreignId('shipping_zone_id')->nullable()->constrained('shipping_zones')->nullOnDelete();
            $table->string('number')->unique();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('shipping_fee', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('total', 10, 2)->default(0);
            $table->string('status')->default(\App\Enums\OrderStatus::EN_ATTENTE->value);
            $table->string('idempotency_key')->nullable()->unique();
            $table->timestamps();
        });

        Schema::create('sub_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->string('status')->default(\App\Enums\OrderStatus::EN_ATTENTE->value);
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sub_order_id')->constrained('sub_orders')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->integer('quantity');
            $table->string('product_name');
            $table->string('sku');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('commission_rate', 5, 2)->default(7.00);
            $table->timestamps();
        });

        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('from_status');
            $table->string('to_status');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('sub_orders');
        Schema::dropIfExists('orders');
    }
};
