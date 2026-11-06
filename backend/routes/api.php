<?php

use App\Http\Controllers\Api\Admin\AdminAuditLogController;
use App\Http\Controllers\Api\Admin\AdminCommissionController;
use App\Http\Controllers\Api\Admin\AdminCouponController;
use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Admin\AdminProductController;
use App\Http\Controllers\Api\Admin\AdminReviewController;
use App\Http\Controllers\Api\Admin\AdminVendorController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\ComplaintController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ShipmentTrackingController;
use App\Http\Controllers\Api\Vendor\VendorOrderController;
use App\Http\Controllers\Api\Vendor\VendorProductController;
use App\Http\Controllers\Api\Vendor\VendorSalesController;
use App\Http\Controllers\Api\Vendor\VendorStockController;
use App\Http\Controllers\Api\WishlistController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

// Authentication (S'authentifier)
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Catalog & Search (Consulter catalogue, Rechercher)
Route::prefix('catalog')->group(function () {
    Route::get('/products', [CatalogController::class, 'index']);
    Route::get('/products/{idOrSlug}', [CatalogController::class, 'show']);
    Route::get('/categories', [CatalogController::class, 'categories']);
    Route::get('/brands', [CatalogController::class, 'brands']);
    Route::get('/products/{productId}/reviews', [ReviewController::class, 'productReviews']);
});

// Cart (Gérer le panier) - accessible with or without auth (uses session/token)
Route::prefix('cart')->group(function () {
    Route::get('/', [CartController::class, 'index']);
    Route::post('/items', [CartController::class, 'addItem']);
    Route::put('/items/{itemId}', [CartController::class, 'updateItem']);
    Route::delete('/items/{itemId}', [CartController::class, 'removeItem']);
    Route::delete('/clear', [CartController::class, 'clear']);
});

// Checkout public helpers (Shipping zones, Coupon verify)
Route::prefix('checkout')->group(function () {
    Route::get('/shipping-zones', [CheckoutController::class, 'getShippingZones']);
    Route::post('/apply-coupon', [CheckoutController::class, 'applyCoupon']);
});

// Shipment tracking (Suivre la livraison - Client / Transporteur)
Route::get('/shipments/track/{trackingNumber}', [ShipmentTrackingController::class, 'track']);
Route::get('/carriers', [ShipmentTrackingController::class, 'carriers']);

// Payment webhook (Prestataire de paiement)
Route::post('/payments/webhook', [PaymentWebhookController::class, 'handleWebhook']);

/*
|--------------------------------------------------------------------------
| Authenticated Routes (Sanctum)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    // User profile (Gérer son profil)
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/address', [AuthController::class, 'updateAddress']);
    });

    // Checkout (Passer commande, Vérifier le stock)
    Route::prefix('checkout')->group(function () {
        Route::get('/verify-stock', [CheckoutController::class, 'verifyStock']);
        Route::post('/place-order', [CheckoutController::class, 'placeOrder']);
    });

    // Orders (Suivre une commande, cancel)
    Route::prefix('orders')->group(function () {
        Route::get('/', [OrderController::class, 'index']);
        Route::get('/{orderId}', [OrderController::class, 'show']);
        Route::post('/{orderId}/cancel', [OrderController::class, 'cancel']);
    });

    // Reviews (Déposer un avis)
    Route::post('/reviews', [ReviewController::class, 'store']);

    // Wishlist
    Route::prefix('wishlist')->group(function () {
        Route::get('/', [WishlistController::class, 'index']);
        Route::post('/{productId}/toggle', [WishlistController::class, 'toggle']);
    });

    // Complaints (Traiter réclamation - Client)
    Route::prefix('complaints')->group(function () {
        Route::post('/', [ComplaintController::class, 'store']);
        Route::get('/my', [ComplaintController::class, 'myComplaints']);
    });

    // Notifications (Journal d'activité utilisateur)
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::put('/{id}/read', [NotificationController::class, 'markAsRead']);
    });

    /*
    |--------------------------------------------------------------------------
    | Vendeur Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('vendor')->middleware('role:vendor')->group(function () {
        // Gérer ses produits, Soumettre produit
        Route::get('/products', [VendorProductController::class, 'index']);
        Route::post('/products', [VendorProductController::class, 'store']);
        Route::post('/products/{id}/submit', [VendorProductController::class, 'submit']);
        Route::delete('/products/{id}', [VendorProductController::class, 'destroy']);

        // Gérer ses stocks
        Route::get('/stocks', [VendorStockController::class, 'index']);
        Route::put('/stocks/{id}', [VendorStockController::class, 'updateStock']);

        // Traiter commandes
        Route::get('/orders', [VendorOrderController::class, 'index']);
        Route::get('/orders/{id}', [VendorOrderController::class, 'show']);
        Route::put('/orders/{id}/status', [VendorOrderController::class, 'updateStatus']);

        // Voir ses ventes
        Route::get('/sales/dashboard', [VendorSalesController::class, 'dashboard']);
    });

    /*
    |--------------------------------------------------------------------------
    | Agent de Support Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('support')->middleware('role:support,admin')->group(function () {
        Route::get('/complaints', [ComplaintController::class, 'index']);
        Route::put('/complaints/{id}', [ComplaintController::class, 'updateStatus']);
    });

    /*
    |--------------------------------------------------------------------------
    | Administrateur Routes
    |--------------------------------------------------------------------------
    */
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        // Tableau de bord
        Route::get('/dashboard/stats', [AdminDashboardController::class, 'stats']);

        // Approuver vendeur
        Route::get('/vendors', [AdminVendorController::class, 'index']);
        Route::put('/vendors/{id}/approve', [AdminVendorController::class, 'approve']);
        Route::put('/vendors/{id}/suspend', [AdminVendorController::class, 'suspend']);

        // Valider un produit
        Route::get('/products/pending', [AdminProductController::class, 'pending']);
        Route::put('/products/{id}/validate', [AdminProductController::class, 'validateProduct']);
        Route::put('/products/{id}/reject', [AdminProductController::class, 'rejectProduct']);

        // Modérer les avis
        Route::get('/reviews/pending', [AdminReviewController::class, 'pending']);
        Route::put('/reviews/{id}/approve', [AdminReviewController::class, 'approve']);
        Route::put('/reviews/{id}/reject', [AdminReviewController::class, 'reject']);

        // Gérer les coupons
        Route::apiResource('coupons', AdminCouponController::class);

        // Gérer commissions & versements
        Route::get('/commissions', [AdminCommissionController::class, 'index']);
        Route::post('/vendors/{vendorId}/payout', [AdminCommissionController::class, 'generatePayout']);
        Route::get('/payouts', [AdminCommissionController::class, 'payouts']);

        // Journaliser action
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
    });
});
