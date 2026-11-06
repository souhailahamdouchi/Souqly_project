<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->unique()->constrained('product_variants')->cascadeOnDelete();
            $table->integer('quantity')->default(0);
            $table->integer('low_threshold')->default(5);
            $table->timestamps();
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_id')->constrained('stocks')->cascadeOnDelete();
            $table->integer('delta'); // + or -
            $table->string('reason');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('stocks');
    }
};
