<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminAuditLogController extends Controller
{
    /**
     * List audit logs
     * UML: Journaliser action
     */
    public function index(Request $request): JsonResponse
    {
        $logs = AuditLog::with('user:id,name,email')
            ->when($request->action, fn($q, $a) => $q->where('action', $a))
            ->when($request->user_id, fn($q, $u) => $q->where('user_id', $u))
            ->orderBy('created_at', 'desc')
            ->paginate(25);

        return response()->json($logs);
    }
}

