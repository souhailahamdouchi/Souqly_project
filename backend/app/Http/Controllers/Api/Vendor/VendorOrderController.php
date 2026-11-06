<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\SubOrder;
use App\Models\Vendor;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorOrderController extends Controller
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
     * List sub-orders of the authenticated vendor (RM-007 isolation).
     */
    public function index(Request $request): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        $subOrders = $vendor->subOrders()
            ->with(['order.user:id,name,email', 'items', 'shipment.carrier'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json($subOrders);
    }

    /**
     * Show a sub-order belonging to the vendor.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        $subOrder = $vendor->subOrders()
            ->with([
                'order.shippingAddress',
                'order.payments',
                'order.statusHistory',
                'items.variant.product',
                'shipment.carrier',
            ])
            ->findOrFail($id);

        return response()->json(['sub_order' => $subOrder]);
    }

    /**
     * Update sub-order status (UML: Traiter commandes).
     *
     * Transitions: CONFIRMEE -> EN_PREPARATION -> EXPEDIEE -> LIVREE.
     * EXPEDIEE requires carrier_id + tracking_number (creates/updates Shipment).
     * Parent order status is recomputed from its sub-orders.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $vendor = $this->vendorFrom($request);

        $subOrder = $vendor->subOrders()
            ->with(['shipment', 'order'])
            ->findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:' . implode(',', [
                OrderStatus::CONFIRMEE->value,
                OrderStatus::EN_PREPARATION->value,
                OrderStatus::EXPEDIEE->value,
                OrderStatus::LIVREE->value,
            ]),
        ]);

        $newStatus = OrderStatus::from($validated['status']);

        if (in_array($subOrder->status, [OrderStatus::ANNULEE, OrderStatus::REMBOURSEE], true)) {
            return response()->json([
                'message' => 'Cette sous-commande est dans un état final (' . $subOrder->status->value . ').',
            ], 422);
        }

        $allowedFrom = match ($newStatus) {
            OrderStatus::CONFIRMEE => [OrderStatus::EN_ATTENTE],
            OrderStatus::EN_PREPARATION => [OrderStatus::EN_ATTENTE, OrderStatus::CONFIRMEE],
            OrderStatus::EXPEDIEE => [OrderStatus::EN_ATTENTE, OrderStatus::CONFIRMEE, OrderStatus::EN_PREPARATION],
            OrderStatus::LIVREE => [OrderStatus::CONFIRMEE, OrderStatus::EN_PREPARATION, OrderStatus::EXPEDIEE],
        };

        if (!in_array($subOrder->status, $allowedFrom, true)) {
            return response()->json([
                'message' => sprintf(
                    'Transition de statut invalide : %s vers %s.',
                    $subOrder->status->value,
                    $newStatus->value
                ),
            ], 422);
        }

        $carrierId = null;
        $trackingNumber = null;

        if ($newStatus === OrderStatus::EXPEDIEE) {
            $shipping = $request->validate([
                'carrier_id' => 'required|exists:carriers,id',
                'tracking_number' => 'required|string|max:100',
            ]);

            $carrierId = $shipping['carrier_id'];
            $trackingNumber = $shipping['tracking_number'];
        }

        $subOrder->update(['status' => $newStatus]);

        if ($newStatus === OrderStatus::EXPEDIEE) {
            $subOrder->shipment()->updateOrCreate(
                ['sub_order_id' => $subOrder->id],
                [
                    'carrier_id' => $carrierId,
                    'tracking_number' => $trackingNumber,
                    'status' => 'en_transit',
                    'shipped_at' => Carbon::now(),
                ]
            );
        }

        if ($newStatus === OrderStatus::LIVREE && $subOrder->shipment) {
            $subOrder->shipment->update(['status' => 'livree']);
        }

        // Recompute parent order status from all its sub-orders
        $subOrder->order->refreshStatusFromSubOrders();

        $subOrder->load(['shipment.carrier', 'items']);

        return response()->json([
            'message' => 'Statut de la sous-commande mis à jour : ' . $newStatus->value . '.',
            'sub_order' => $subOrder,
        ]);
    }
}
