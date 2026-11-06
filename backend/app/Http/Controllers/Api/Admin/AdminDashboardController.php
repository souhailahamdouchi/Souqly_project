<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\VendorStatus;
use App\Http\Controllers\Controller;
use App\Models\Commission;
use App\Models\Complaint;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;

class AdminDashboardController extends Controller
{
    /**
     * Admin dashboard summary statistics & analytics
     * UML: Accéder au tableau de bord
     */
    public function stats(): JsonResponse
    {
        $totalSales = Order::where('status', '!=', OrderStatus::ANNULEE)->sum('total');
        $totalCommissions = Commission::sum('amount');
        $totalOrders = Order::count();
        $totalUsers = User::count();

        $activeVendors = Vendor::where('status', VendorStatus::APPROUVE)->count();
        $pendingVendors = Vendor::where('status', VendorStatus::EN_ATTENTE)->count();

        $pendingProducts = Product::where('status', ProductStatus::EN_ATTENTE)->count();
        $publishedProducts = Product::where('status', ProductStatus::PUBLIE)->count();

        $pendingReviews = Review::where('status', 'en_attente')->count();
        $openComplaints = Complaint::where('status', 'ouverte')->count();

        $recentOrders = Order::with(['user', 'subOrders.vendor', 'payments'])
            ->latest()
            ->limit(8)
            ->get();

        return response()->json([
            'metrics' => [
                'total_sales' => (float) $totalSales,
                'total_commissions' => (float) $totalCommissions,
                'total_orders' => $totalOrders,
                'total_users' => $totalUsers,
                'active_vendors' => $activeVendors,
                'pending_vendors' => $pendingVendors,
                'published_products' => $publishedProducts,
                'pending_products' => $pendingProducts,
                'pending_reviews' => $pendingReviews,
                'open_complaints' => $openComplaints,
            ],
            'recent_orders' => $recentOrders,
        ]);
    }
}

