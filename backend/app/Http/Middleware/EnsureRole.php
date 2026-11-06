<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route middleware alias: 'role:admin' | 'role:support,admin' | 'role:vendor'
 *
 * Accepts one or many authorized roles. The request proceeds only if the
 * authenticated user owns at least one of them (RM-007 strict role isolation).
 */
class EnsureRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            abort(401, 'Authentification requise.');
        }

        foreach ($roles as $role) {
            if ($user->hasRole($role)) {
                return $next($request);
            }
        }

        abort(403, 'Accès refusé : vous ne disposez pas des droits nécessaires pour cette action.');
    }
}
