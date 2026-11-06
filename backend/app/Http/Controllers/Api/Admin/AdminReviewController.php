<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Review;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminReviewController extends Controller
{
    /**
     * List reviews awaiting moderation
     * UML: Modérer les avis
     */
    public function pending(): JsonResponse
    {
        $reviews = Review::where('status', 'en_attente')
            ->with(['user', 'product'])
            ->orderBy('created_at', 'asc')
            ->paginate(15);

        return response()->json($reviews);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        $review = Review::findOrFail($id);
        $review->update(['status' => 'approuve']);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'APPROVE_REVIEW',
            'entity_type' => Review::class,
            'entity_id' => $review->id,
            'before' => ['status' => 'en_attente'],
            'after' => ['status' => 'approuve'],
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Avis approuvé.',
            'review' => $review,
        ]);
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $review = Review::findOrFail($id);
        $review->update(['status' => 'rejete']);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'REJECT_REVIEW',
            'entity_type' => Review::class,
            'entity_id' => $review->id,
            'before' => ['status' => 'en_attente'],
            'after' => ['status' => 'rejete'],
            'created_at' => Carbon::now(),
        ]);

        return response()->json([
            'message' => 'Avis rejeté.',
            'review' => $review,
        ]);
    }
}
