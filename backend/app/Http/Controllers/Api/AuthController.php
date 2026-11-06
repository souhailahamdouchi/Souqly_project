<?php

namespace App\Http\Controllers\Api;

use App\Enums\VendorStatus;
use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Support\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user (Client or Vendor)
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6|confirmed',
            'phone' => 'nullable|string|max:30',
            'locale' => 'nullable|string|in:fr,ar',
            'role' => 'nullable|string|in:client,vendor',
            'shop_name' => 'required_if:role,vendor|nullable|string|max:255',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
            'locale' => $validated['locale'] ?? 'fr',
        ]);

        $roleName = $validated['role'] ?? 'client';
        $role = Role::firstOrCreate(['name' => $roleName]);
        $user->roles()->attach($role->id);

        if ($roleName === 'vendor') {
            Vendor::create([
                'user_id' => $user->id,
                'shop_name' => $validated['shop_name'] ?? ($user->name . ' Shop'),
                'status' => VendorStatus::EN_ATTENTE,
                'commission_rate' => 7.00, // RM-008: 7% platform commission
            ]);
        }

        // Welcome notification (Notification journal)
        Notifier::send($user, 'COMPTE_CREE', [
            'message' => 'Bienvenue sur Souqly !',
            'role' => $roleName,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Compte créé avec succès',
            'user' => $user->load(['roles', 'vendor']),
            'token' => $token,
        ], 201);
    }

    /**
     * Authenticate user & generate token
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::with(['roles', 'vendor', 'addresses'])->where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Les identifiants fournis sont incorrects.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Connexion réussie',
            'user' => $user,
            'token' => $token,
        ]);
    }

    /**
     * Logout & revoke current token
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie']);
    }

    /**
     * Get authenticated user profile
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['roles', 'vendor', 'addresses']);

        return response()->json([
            'user' => $user,
        ]);
    }

    /**
     * Update user profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => 'nullable|string|max:30',
            'locale' => 'nullable|string|in:fr,ar',
            'password' => 'nullable|string|min:6|confirmed',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'Profil mis à jour',
            'user' => $user->load(['roles', 'vendor', 'addresses']),
        ]);
    }

    /**
     * Add or update default address
     */
    public function updateAddress(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'city' => 'required|string|max:100',
            'street' => 'required|string|max:255',
            'phone' => 'required|string|max:30',
            'is_default' => 'nullable|boolean',
        ]);

        if (!empty($validated['is_default'])) {
            $user->addresses()->update(['is_default' => false]);
        }

        $address = $user->addresses()->create([
            'city' => $validated['city'],
            'street' => $validated['street'],
            'phone' => $validated['phone'],
            'is_default' => $validated['is_default'] ?? true,
        ]);

        return response()->json([
            'message' => 'Adresse enregistrée',
            'address' => $address,
        ]);
    }
}
