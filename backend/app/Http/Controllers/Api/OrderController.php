<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * List user's orders
     * UML: Suivre une commande
     */
    public function index(Request $request): JsonResponse
    {
        $orders = Order::where('user_id', $request->user()->id)
            ->with(['subOrders.items', 'subOrders.vendor', 'subOrders.shipment.carrier', 'payments'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json($orders);
    }

    /**
     * Order detail tracking
     */
    public function show(Request $request, int $orderId): JsonResponse
    {
        $order = Order::where('user_id', $request->user()->id)
            ->with([
                'subOrders.items.variant.product.images',
                'subOrders.vendor',
                'subOrders.shipment.carrier',
                'shippingAddress',
                'payments',
                'statusHistory',
            ])
            ->findOrFail($orderId);

        return response()->json([
            'order' => $order,
        ]);
    }

    /**
     * Cancel an order
     * UML: cancel(): void
     */
    public function cancel(Request $request, int $orderId): JsonResponse
    {
        $order = Order::where('user_id', $request->user()->id)->findOrFail($orderId);

        try {
            $order->cancel();
            return response()->json([
                'message' => 'Commande annulée avec succès.',
                'order' => $order->fresh(['subOrders']),
            ]);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
