<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('gross_amount', 10, 2)->default(0);
            $table->decimal('commission_total', 10, 2)->default(0);
            $table->decimal('refunds_total', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2)->default(0);
            $table->string('status')->default(\App\Enums\PayoutStatus::EN_ATTENTE->value);
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sub_order_id')->constrained('sub_orders')->cascadeOnDelete();
            $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
            $table->foreignId('payout_id')->nullable()->constrained('payouts')->nullOnDelete();
            $table->decimal('rate', 5, 2);
            $table->decimal('amount', 10, 2);
            $table->string('status')->default(\App\Enums\CommissionStatus::EN_ATTENTE->value);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commissions');
        Schema::dropIfExists('payouts');
    }
};
