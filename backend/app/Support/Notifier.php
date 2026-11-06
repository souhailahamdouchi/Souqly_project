<?php

namespace App\Support;

use App\Models\Notification;
use App\Models\User;

/**
 * Central notification dispatcher.
 *
 * Persists in-app notifications (channel: database) for domain events:
 * account creation, payment status, order status changes, vendor
 * validation, product moderation, complaints, payouts.
 */
class Notifier
{
    /**
     * Send a notification to a user.
     *
     * @param  User|null  $user    Target user (silently skipped when null).
     * @param  string     $type    Event type, e.g. COMPTE_CREE, PAIEMENT_RECU, COMMANDE_LIVREE.
     * @param  array      $data    Arbitrary payload stored as JSON.
     * @param  string     $channel Delivery channel ('database' for now).
     * @return Notification|null
     */
    public static function send(?User $user, string $type, array $data = [], string $channel = 'database'): ?Notification
    {
        if (!$user) {
            return null;
        }

        return $user->notifications()->create([
            'type' => $type,
            'data' => $data,
            'channel' => $channel,
            'read_at' => null,
        ]);
    }
}
