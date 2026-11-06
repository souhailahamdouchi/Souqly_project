<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * List the authenticated user's notifications (latest first)
     * with their unread count.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = $user->notifications()
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $user->notifications()->whereNull('read_at')->count(),
        ]);
    }

    /**
     * Mark a notification as read (owner-only).
     */
    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $notification = Notification::where('user_id', $request->user()->id)->findOrFail($id);

        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return response()->json([
            'message' => 'Notification marquée comme lue.',
            'notification' => $notification,
        ]);
    }
}
