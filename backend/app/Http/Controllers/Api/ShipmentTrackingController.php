<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Carrier;
use App\Models\Shipment;
use Illuminate\Http\JsonResponse;

class ShipmentTrackingController extends Controller
{
    /**
     * List available carriers (used by the vendor "ship order" modal)
     * UML Use Case: Expédier une commande (Vendeur)
     */
    public function carriers(): JsonResponse
    {
        return response()->json(
            Carrier::orderBy('name')->get(['id', 'name'])
        );
    }

    /**
     * Track shipment delivery status
     * UML Use Case: Suivre la livraison (Client, Transporteur)
     */
    public function track(string $trackingNumber): JsonResponse
    {
        $shipment = Shipment::with(['carrier', 'subOrder.order.shippingAddress', 'subOrder.items'])
            ->where('tracking_number', $trackingNumber)
            ->firstOrFail();

        return response()->json([
            'tracking_number' => $shipment->tracking_number,
            'status' => $shipment->status,
            'carrier' => $shipment->carrier->name ?? 'Transporteur Standard',
            'shipped_at' => $shipment->shipped_at,
            'delivery_address' => [
                'city' => $shipment->subOrder->order->shippingAddress->city ?? null,
                'street' => $shipment->subOrder->order->shippingAddress->street ?? null,
            ],
            'items' => $shipment->subOrder->items->map(fn($item) => [
                'product_name' => $item->product_name,
                'quantity' => $item->quantity,
            ]),
        ]);
    }
}
