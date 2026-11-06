<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('complaints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // reporter
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete(); // support agent
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('subject');
            $table->text('description');
            $table->string('status')->default('ouverte'); // ouverte, en_cours, resolue, fermee
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('complaints');
    }
};
