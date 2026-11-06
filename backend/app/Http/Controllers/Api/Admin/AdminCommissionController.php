<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\CommissionStatus;
use App\Enums\PayoutStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Commission;
use App\Models\Payout;
use App\Models\Vendor;
use App\Support\Notifier;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminCommissionController extends Controller
{
    /**
     * List commissions
     * UML: Gérer commissions
     */
    public function index(Request $request): JsonResponse
    {
        $commissions = Commission::with(['vendor', 'subOrder.order'])
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->when($request->vendor_id, fn($q, $v) => $q->where('vendor_id', $v))
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($commissions);
    }

    /**
     * Generate vendor payout for a given period.
     * Eligible commissions: status EN_ATTENTE or DUE (confirmed orders
     * waiting for payment as well as delivered orders ready to pay).
     */
    public function generatePayout(Request $request, int $vendorId): JsonResponse
    {
        $vendor = Vendor::with('user')->findOrFail($vendorId);

        $validated = $request->validate([
            'period_start' => 'required|date',
            'period_end' => 'required|date|after_or_equal:period_start',
        ]);

        $commissions = Commission::where('vendor_id', $vendor->id)
            ->whereIn('status', [CommissionStatus::EN_ATTENTE->value, CommissionStatus::DUE->value])
            ->whereBetween('created_at', [
                Carbon::parse($validated['period_start'])->startOfDay(),
                Carbon::parse($validated['period_end'])->endOfDay(),
            ])
            ->get();

        if ($commissions->isEmpty()) {
            return response()->json([
                'message' => 'Aucune commission éligible au versement pour cette période.',
            ], 422);
        }

        $payout = DB::transaction(function () use ($vendor, $validated, $request, $commissions) {
            $totalCommission = $commissions->sum('amount');
            $grossAmount = $commissions->sum(fn($c) => $c->subOrder->subtotal ?? 0);
            $netAmount = max(0, $grossAmount - $totalCommission);

            $payout = Payout::create([
                'vendor_id' => $vendor->id,
                'period_start' => $validated['period_start'],
                'period_end' => $validated['period_end'],
                'gross_amount' => $grossAmount,
                'commission_total' => $totalCommission,
                'refunds_total' => 0.00,
                'net_amount' => $netAmount,
                'status' => PayoutStatus::VERSE,
                'paid_at' => Carbon::now(),
            ]);

            // Link commissions to this payout and mark them as VERSEE (idempotent per commission)
            foreach ($commissions as $comm) {
                $comm = Commission::find($comm->id);

                if ($comm->status === CommissionStatus::ANNULEE) {
                    continue; // Order canceled meanwhile — never paid out
                }

                $comm->update([
                    'payout_id' => $payout->id,
                    'status' => CommissionStatus::VERSEE,
                ]);
            }

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'GENERATE_PAYOUT',
                'entity_type' => Payout::class,
                'entity_id' => $payout->id,
                'before' => null,
                'after' => $payout->toArray(),
                'created_at' => Carbon::now(),
            ]);

            return $payout;
        });

        // Notify the vendor (Notification journal)
        Notifier::send($vendor->user, 'VERSEMENT_CREE', [
            'payout_id' => $payout->id,
            'net_amount' => (float) $payout->net_amount,
            'period_start' => $payout->period_start,
            'period_end' => $payout->period_end,
        ]);

        return response()->json([
            'message' => 'Versement généré avec succès pour le vendeur.',
            'payout' => $payout->load('commissions'),
        ], 201);
    }

    /**
     * List all payouts
     */
    public function payouts(): JsonResponse
    {
        $payouts = Payout::with('vendor')
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json($payouts);
    }
}
