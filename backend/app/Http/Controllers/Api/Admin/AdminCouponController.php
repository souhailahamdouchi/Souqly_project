<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Coupon;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminCouponController extends Controller
{
    /**
     * List coupons
     * UML: Gérer les coupons
     */
    public function index(): JsonResponse
    {
        $coupons = Coupon::withCount('usages')
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json($coupons);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|unique:coupons,code|max:50',
            'type' => 'required|string|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'starts_at' => 'required|date',
            'expires_at' => 'required|date|after_or_equal:starts_at',
            'quota' => 'required|integer|min:1',
            'per_user_limit' => 'nullable|integer|min:1',
        ]);

        $validated['code'] = strtoupper($validated['code']);
        $coupon = Coupon::create($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'CREATE_COUPON',
            'entity_type' => Coupon::class,
            'entity_id' => $coupon->id,
            'before' => null,
            'after' => $coupon->toArray(),
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Coupon créé avec succès.',
            'coupon' => $coupon,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $coupon = Coupon::findOrFail($id);
        $before = $coupon->toArray();

        $validated = $request->validate([
            'type' => 'sometimes|required|string|in:percentage,fixed',
            'value' => 'sometimes|required|numeric|min:0',
            'starts_at' => 'sometimes|required|date',
            'expires_at' => 'sometimes|required|date|after_or_equal:starts_at',
            'quota' => 'sometimes|required|integer|min:1',
            'per_user_limit' => 'nullable|integer|min:1',
        ]);

        $coupon->update($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'UPDATE_COUPON',
            'entity_type' => Coupon::class,
            'entity_id' => $coupon->id,
            'before' => $before,
            'after' => $coupon->fresh()->toArray(),
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Coupon mis à jour.',
            'coupon' => $coupon,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $coupon = Coupon::findOrFail($id);
        $before = $coupon->toArray();
        $coupon->delete();

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'DELETE_COUPON',
            'entity_type' => Coupon::class,
            'entity_id' => $id,
            'before' => $before,
            'after' => null,
            'created_at' => Carbon::now(),
        ]);

        return response()->json(['message' => 'Coupon supprimé.']);
    }
}
