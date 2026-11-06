<?php

namespace App\Http\Controllers\Api;

use App\Enums\CommissionStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Transaction;
use App\Support\Notifier;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentWebhookController extends Controller
{
    /**
     * Webhook handler for external payment gateway (Prestataire de paiement)
     * UML: Choisir paiement, verifyWebhook()
     *
     * Security: the gateway signs the RAW body with HMAC-SHA256 using
     * PAYMENT_WEBHOOK_SECRET and sends it in the "X-Signature" header.
     * Business: on success -> order CONFIRMEE + commissions DUE (RM-008),
     * on failure -> order ANNULEE + stock restored (DS, paiement échoué).
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $providerRef = $request->input('provider_ref');
        $status = $request->input('status', 'success');

        if (!$providerRef) {
            return response()->json(['message' => 'provider_ref manquant'], 400);
        }

        $payment = Payment::with('order')->where('provider_ref', $providerRef)->first();

        if (!$payment) {
            return response()->json(['message' => 'Paiement non trouvé'], 404);
        }

        // Verify webhook authenticity: HMAC-SHA256 over the RAW payload
        if (!$payment->verifyWebhook($request->getContent(), $request->header('X-Signature'))) {
            return response()->json(['message' => 'Signature de webhook invalide'], 403);
        }

        $isSuccess = in_array(strtolower($status), ['success', 'paid', 'approved', 'completed'], true);

        // Log transaction (RM-010 journalisation)
        Transaction::create([
            'payment_id' => $payment->id,
            'type' => 'webhook',
            'status' => $isSuccess ? 'SUCCESS' : 'FAILED',
            'payload' => $request->json()->all(),
            'created_at' => Carbon::now(),
        ]);

        $order = $payment->order;

        if ($isSuccess) {
            // Idempotent acknowledgement: no double side effect
            if ($payment->status !== PaymentStatus::PAYE) {
                $payment->markPaid();
            }

            if ($order) {
                // Confirm the order when the payment is validated (with history)
                if ($order->status === OrderStatus::EN_ATTENTE) {
                    $order->place();
                }

                // Commissions become DUE for every active vendor sub-order
                foreach (
                    $order->subOrders()
                        ->whereNotIn('status', [OrderStatus::ANNULEE->value, OrderStatus::REMBOURSEE->value])
                        ->get() as $subOrder
                ) {
                    $subOrder->commissions()
                        ->where('status', CommissionStatus::EN_ATTENTE->value)
                        ->update(['status' => CommissionStatus::DUE->value]);
                }

                Notifier::send($order->user, 'PAIEMENT_RECU', [
                    'order_id' => $order->id,
                    'order_number' => $order->number,
                    'amount' => (float) $payment->amount,
                ]);
            }
        } else {
            $payment->markFailed();

            // DS: on payment failure the order is cancelled and stock restored
            if (
                $order
                && $payment->method !== 'cash_on_delivery'
                && $order->status === OrderStatus::EN_ATTENTE
            ) {
                $order->cancel();
            }
        }

        return response()->json([
            'status' => 'acknowledged',
            'payment_status' => $payment->status->value,
        ]);
    }
}
