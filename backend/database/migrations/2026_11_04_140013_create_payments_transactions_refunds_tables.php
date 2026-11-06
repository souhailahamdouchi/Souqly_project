<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('method'); // cash_on_delivery, card, stripe, cmi
            $table->string('status')->default(\App\Enums\PaymentStatus::EN_ATTENTE->value);
            $table->decimal('amount', 10, 2);
            $table->string('provider_ref')->nullable();
            $table->timestamps();
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->string('type'); // charge, webhook, refund
            $table->string('status');
            $table->json('payload')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('reason');
            $table->string('status')->default('pending');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('payments');
    }
};
