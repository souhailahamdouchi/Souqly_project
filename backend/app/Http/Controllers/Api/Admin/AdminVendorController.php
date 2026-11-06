<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Vendor;
use App\Support\Notifier;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminVendorController extends Controller
{
    /**
     * List all vendors with status filter
     */
    public function index(Request $request): JsonResponse
    {
        $vendors = Vendor::with('user')
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json($vendors);
    }

    /**
     * Approve a vendor
     * UML: Approuver vendeur / approve(): void
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        $vendor = Vendor::with('user')->findOrFail($id);
        $before = $vendor->toArray();

        if ($vendor->status->value !== 'APPROUVE') {
            $vendor->approve();

            // Inform the vendor (Notification journal)
            Notifier::send($vendor->user, 'VENDEUR_APPROUVE', [
                'vendor_id' => $vendor->id,
                'shop_name' => $vendor->shop_name,
                'message' => 'Votre boutique a été approuvée. Vous pouvez publier vos produits.',
            ]);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'APPROVE_VENDOR',
            'entity_type' => Vendor::class,
            'entity_id' => $vendor->id,
            'before' => $before,
            'after' => $vendor->fresh()->toArray(),
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Vendeur approuvé avec succès.',
            'vendor' => $vendor,
        ]);
    }

    /**
     * Suspend a vendor
     * UML: suspend(): void
     */
    public function suspend(Request $request, int $id): JsonResponse
    {
        $vendor = Vendor::with('user')->findOrFail($id);
        $before = $vendor->toArray();

        if ($vendor->status->value !== 'SUSPENDU') {
            $vendor->suspend();

            // Inform the vendor (Notification journal)
            Notifier::send($vendor->user, 'VENDEUR_SUSPENDU', [
                'vendor_id' => $vendor->id,
                'shop_name' => $vendor->shop_name,
                'message' => 'Votre boutique a été suspendue par l\'administration.',
            ]);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'SUSPEND_VENDOR',
            'entity_type' => Vendor::class,
            'entity_id' => $vendor->id,
            'before' => $before,
            'after' => $vendor->fresh()->toArray(),
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Vendeur suspendu.',
            'vendor' => $vendor,
        ]);
    }
}
