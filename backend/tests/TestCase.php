<?php

namespace Tests;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function createUser(string $role = 'client', array $attributes = []): User
    {
        $roleModel = Role::firstOrCreate(['name' => $role]);

        $user = User::create(array_merge([
            'name' => 'Test '.ucfirst($role),
            'email' => strtolower($role).'-'.uniqid().'@souqly.ma',
            'password' => bcrypt('password123'),
        ], $attributes));

        $user->roles()->attach($roleModel->id);

        return $user;
    }

    protected function authHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    /**
     * Switch the authenticated identity mid-test. Laravel caches the resolved
     * user inside the auth guard between simulated requests, so guards must
     * be dropped before the new Bearer token is honored.
     */
    protected function switchAuth(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeaders($this->authHeaders($user));
    }
}
