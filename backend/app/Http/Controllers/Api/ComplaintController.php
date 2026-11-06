<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ComplaintController extends Controller
{
    /**
     * File a complaint (Client)
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => 'nullable|exists:orders,id',
            'subject' => 'required|string|max:255',
            'description' => 'required|string|min:10',
        ]);

        $complaint = Complaint::create([
            'user_id' => $request->user()->id,
            'order_id' => $validated['order_id'] ?? null,
            'subject' => $validated['subject'],
            'description' => $validated['description'],
            'status' => 'ouverte',
        ]);

        return response()->json([
            'message' => 'Réclamation enregistrée avec succès. Notre équipe support va la traiter.',
            'complaint' => $complaint,
        ], 201);
    }

    /**
     * Client's own complaints
     */
    public function myComplaints(Request $request): JsonResponse
    {
        $complaints = Complaint::where('user_id', $request->user()->id)
            ->with(['order', 'assignee:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($complaints);
    }

    /**
     * Support agent: list all complaints
     * UML Use Case: Traiter réclamation (Agent de support)
     */
    public function index(Request $request): JsonResponse
    {
        $complaints = Complaint::with(['reporter:id,name,email,phone', 'assignee:id,name', 'order'])
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return response()->json($complaints);
    }

    /**
     * Support agent: update status or assign complaint
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $complaint = Complaint::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:ouverte,en_cours,resolue,fermee',
            'assignee_id' => 'nullable|exists:users,id',
        ]);

        $complaint->update([
            'status' => $validated['status'],
            'assignee_id' => $validated['assignee_id'] ?? $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Statut de la réclamation mis à jour.',
            'complaint' => $complaint->fresh(['reporter', 'assignee']),
        ]);
    }
}
