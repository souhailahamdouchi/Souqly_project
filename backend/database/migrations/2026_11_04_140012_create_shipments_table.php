<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sub_order_id')->unique()->constrained('sub_orders')->cascadeOnDelete();
            $table->foreignId('carrier_id')->nullable()->constrained('carriers')->nullOnDelete();
            $table->string('tracking_number')->unique();
            $table->string('status')->default('en_preparation');
            $table->timestamp('shipped_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
