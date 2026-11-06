<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Enums\CommissionStatus;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorSalesController extends Controller
{
    /**
     * Resolve the authenticated vendor profile or abort.
     */
    protected function vendorFrom(Request $request): Vendor
    {
        $vendor = $request->user()->vendor;

        if (!$vendor) {
            abort(403, 'Aucun profil vendeur associé à ce compte.');
        }

        return $vendor;
    }

    /**
     * Vendor sales dashboard: KPIs + recent sub-orders
     * (UML: Voir ses ventes). Commission rate is 7% (RM-008).
     */
    public function dashboard(Request $request): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        $validStatuses = [
            OrderStatus::CONFIRMEE,
            OrderStatus::EN_PREPARATION,
            OrderStatus::EXPEDIEE,
            OrderStatus::LIVREE,
        ];

        $totalSales = (float) $vendor->subOrders()
            ->whereIn('status', $validStatuses)
            ->sum('subtotal');

        $commissionTotal = (float) $vendor->commissions()
            ->where('status', '!=', CommissionStatus::ANNULEE)
            ->sum('amount');

        $pendingCommission = (float) $vendor->commissions()
            ->whereIn('status', [CommissionStatus::EN_ATTENTE, CommissionStatus::DUE])
            ->sum('amount');

        $totalOrders = (int) $vendor->subOrders()
            ->whereNotIn('status', [OrderStatus::ANNULEE, OrderStatus::REMBOURSEE])
            ->count();

        $deliveredOrders = (int) $vendor->subOrders()
            ->where('status', OrderStatus::LIVREE)
            ->count();

        $pendingOrders = (int) $vendor->subOrders()
            ->whereIn('status', [OrderStatus::EN_ATTENTE, OrderStatus::CONFIRMEE, OrderStatus::EN_PREPARATION])
            ->count();

        $recent = $vendor->subOrders()
            ->with(['order:id,number,created_at', 'shipment.carrier'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(fn($sub) => [
                'id' => $sub->id,
                'order_number' => $sub->order?->number,
                'subtotal' => (float) $sub->subtotal,
                'status' => $sub->status->value,
                'carrier' => $sub->shipment?->carrier?->name,
                'tracking_number' => $sub->shipment?->tracking_number,
                'created_at' => $sub->created_at,
            ]);

        return response()->json([
            'kpis' => [
                'total_sales' => round($totalSales, 2),
                'total_commissions' => round($commissionTotal, 2),
                'net_earnings' => round(max(0, $totalSales - $commissionTotal), 2),
                'pending_payout' => round($pendingCommission, 2),
                'total_orders' => $totalOrders,
                'delivered_orders' => $deliveredOrders,
                'pending_orders' => $pendingOrders,
            ],
            'recent_orders' => $recent,
        ]);
    }
}
