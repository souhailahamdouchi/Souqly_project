<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_can_register_and_receive_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Amine Client',
            'email' => 'new@souqly.ma',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'phone' => '+212600112233',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.email', 'new@souqly.ma')
            ->assertJsonStructure(['message', 'user', 'token']);

        $this->assertDatabaseHas('users', ['email' => 'new@souqly.ma']);
    }

    public function test_registration_requires_password_confirmation(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'No Confirm',
            'email' => 'wrong@souqly.ma',
            'password' => 'password123',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_vendor_registration_creates_shop_in_pending_status(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'TechShop',
            'email' => 'shop@souqly.ma',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'vendor',
            'shop_name' => 'TechShop Casablanca',
        ]);

        $response->assertCreated()->assertJsonPath('user.roles.0.name', 'vendor');
        $this->assertDatabaseHas('vendors', ['shop_name' => 'TechShop Casablanca', 'status' => 'EN_ATTENTE']);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = $this->createUser('client');

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonStructure(['message', 'user', 'token']);
    }

    public function test_login_fails_with_wrong_credentials(): void
    {
        $user = $this->createUser('client');

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422);
    }

    public function test_authenticated_user_can_fetch_profile(): void
    {
        $user = $this->createUser('client');

        $response = $this->getJson('/api/auth/me', $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('user.email', $user->email);
    }

    public function test_profile_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }

    public function test_user_can_update_profile_name_and_phone(): void
    {
        $user = $this->createUser('client');

        $response = $this->putJson('/api/auth/profile', [
            'name' => 'Nouveau Nom',
            'phone' => '+212711223344',
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('user.name', 'Nouveau Nom');
        $this->assertDatabaseHas('users', ['id' => $user->id, 'phone' => '+212711223344']);
        $this->assertTrue(Hash::check('password123', $user->fresh()->password));
    }

    public function test_user_can_change_password(): void
    {
        $user = $this->createUser('client');

        $response = $this->putJson('/api/auth/profile', [
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ], $this->authHeaders($user));

        $response->assertOk();
        $this->assertTrue(Hash::check('newpassword123', $user->fresh()->password));
    }

    public function test_user_can_save_delivery_address(): void
    {
        $user = $this->createUser('client');

        $response = $this->postJson('/api/auth/address', [
            'city' => 'Casablanca',
            'street' => '12 Rue Zerktouni',
            'phone' => '+212600998877',
            'is_default' => true,
        ], $this->authHeaders($user));

        $response->assertOk()->assertJsonPath('address.city', 'Casablanca');
        $this->assertDatabaseHas('addresses', ['user_id' => $user->id, 'is_default' => 1]);
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = $this->createUser('client');
        $headers = $this->authHeaders($user);

        $this->postJson('/api/auth/logout', [], $headers)->assertOk();
        // Token revoked from storage
        $this->assertSame(0, $user->tokens()->count());
    }
}
