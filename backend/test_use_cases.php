<?php

$baseUrl = 'http://127.0.0.1:8000/api';

$results = [];

function request($method, $endpoint, $data = null, $token = null, $extraHeaders = []) {
    global $baseUrl;
    $ch = curl_init($baseUrl . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $headers = [
        'Accept: application/json',
        'Content-Type: application/json',
    ];

    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    foreach ($extraHeaders as $header) {
        $headers[] = $header;
    }

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'code' => $httpCode,
        'data' => json_decode($response, true),
        'raw' => $response,
    ];
}

function recordResult($useCase, $actor, $success, $details) {
    global $results;
    $results[] = [
        'use_case' => $useCase,
        'actor' => $actor,
        'status' => $success ? 'PASS' : 'FAIL',
        'details' => $details,
    ];
    echo ($success ? "[OK]" : "[FAIL]") . " ($actor) $useCase: $details\n";
}

echo "====================================================================\n";
echo "   VERIFICATION DES CAS D'UTILISATION (USE CASES) SOUQLY   \n";
echo "====================================================================\n\n";

// --- 1. S'authentifier (Visiteur -> Client, Vendeur, Admin, Support) ---
$loginClient = request('POST', '/auth/login', ['email' => 'client@souqly.ma', 'password' => 'password123']);
$clientToken = $loginClient['data']['token'] ?? null;
recordResult("S'authentifier", "Client", $loginClient['code'] === 200 && $clientToken !== null, "Token obtenu pour client@souqly.ma");

$loginVendor = request('POST', '/auth/login', ['email' => 'vendor@souqly.ma', 'password' => 'password123']);
$vendorToken = $loginVendor['data']['token'] ?? null;
recordResult("S'authentifier", "Vendeur", $loginVendor['code'] === 200 && $vendorToken !== null, "Token obtenu pour vendor@souqly.ma");

$loginAdmin = request('POST', '/auth/login', ['email' => 'admin@souqly.ma', 'password' => 'password123']);
$adminToken = $loginAdmin['data']['token'] ?? null;
recordResult("S'authentifier", "Administrateur", $loginAdmin['code'] === 200 && $adminToken !== null, "Token obtenu pour admin@souqly.ma");

$loginSupport = request('POST', '/auth/login', ['email' => 'support@souqly.ma', 'password' => 'password123']);
$supportToken = $loginSupport['data']['token'] ?? null;
recordResult("S'authentifier", "Agent de support", $loginSupport['code'] === 200 && $supportToken !== null, "Token obtenu pour support@souqly.ma");

// --- 2. Consulter catalogue (Visiteur / Client) ---
$catalog = request('GET', '/catalog/products');
$hasProducts = !empty($catalog['data']['data']);
$firstProduct = $hasProducts ? $catalog['data']['data'][0] : null;
recordResult("Consulter catalogue", "Visiteur / Client", $catalog['code'] === 200 && $hasProducts, "Catalogue chargé avec " . count($catalog['data']['data'] ?? []) . " produits");

// Detail produit
if ($firstProduct) {
    $detail = request('GET', '/catalog/products/' . $firstProduct['slug']);
    recordResult("Consulter fiche produit", "Visiteur / Client", $detail['code'] === 200 && isset($detail['data']['product']), "Fiche produit: " . $firstProduct['name']);
}

// --- 3. Rechercher (Visiteur / Client) ---
$search = request('GET', '/catalog/products?search=Casque');
$searchOk = $search['code'] === 200 && count($search['data']['data'] ?? []) > 0;
recordResult("Rechercher", "Visiteur / Client", $searchOk, "Recherche 'Casque' a retourné " . count($search['data']['data'] ?? []) . " résultat(s)");

// --- 4. Gérer son profil (Client) ---
$profile = request('GET', '/auth/me', null, $clientToken);
$updateAddress = request('POST', '/auth/address', [
    'city' => 'Casablanca',
    'street' => '45 Boulevard Zerktouni',
    'phone' => '+212611223344',
    'is_default' => true,
], $clientToken);
$addressId = $updateAddress['data']['address']['id'] ?? null;
recordResult("Gérer son profil", "Client", $profile['code'] === 200 && $updateAddress['code'] === 200, "Profil récupéré et adresse enregistrée (ID: $addressId)");

// --- 5. Gérer le panier (Client) ---
$variantId = $firstProduct['variants'][0]['id'] ?? 1;
$addCart = request('POST', '/cart/items', [
    'product_variant_id' => $variantId,
    'quantity' => 1,
], $clientToken);
$cart = request('GET', '/cart', null, $clientToken);
$cartCount = $cart['data']['count'] ?? 0;
recordResult("Gérer le panier", "Client", $addCart['code'] === 200 && $cartCount >= 1, "Article ajouté, panier contient $cartCount article(s), total: " . ($cart['data']['total'] ?? 0) . " MAD");

// --- 6. Vérifier le stock («include» Passer commande) ---
$checkStock = request('GET', '/checkout/verify-stock', null, $clientToken);
recordResult("Vérifier le stock", "Système / Client", $checkStock['code'] === 200 && ($checkStock['data']['valid'] ?? false), "Stock vérifié avec succès: " . ($checkStock['data']['message'] ?? ''));

// --- 7. Appliquer coupon («include» Passer commande) ---
$couponCheck = request('POST', '/checkout/apply-coupon', [
    'code' => 'BIENVENUE10',
    'subtotal' => $cart['data']['total'] ?? 450.00,
], $clientToken);
$discount = $couponCheck['data']['discount'] ?? 0;
recordResult("Appliquer coupon", "Client", $couponCheck['code'] === 200 && $discount > 0, "Coupon BIENVENUE10 validé, réduction: $discount MAD");

// --- 8. Choisir paiement & Passer commande (Client -> Prestataire de paiement) ---
$orderReq = request('POST', '/checkout/place-order', [
    'shipping_address_id' => $addressId,
    'payment_method' => 'cash_on_delivery',
    'coupon_code' => 'BIENVENUE10',
    'idempotency_key' => 'IDEMP-' . uniqid(),
], $clientToken);
$order = $orderReq['data']['order'] ?? null;
$orderId = $order['id'] ?? null;
$orderNumber = $order['number'] ?? '';
recordResult("Passer commande (Choisir paiement)", "Client", $orderReq['code'] === 201 && $orderId !== null, "Commande passée #$orderNumber, total: " . ($order['total'] ?? 0) . " MAD");

// --- 9. Suivre une commande (Client) ---
$trackOrder = request('GET', "/orders/$orderId", null, $clientToken);
recordResult("Suivre une commande", "Client", $trackOrder['code'] === 200 && (isset($trackOrder['data']['order']['statusHistory']) || isset($trackOrder['data']['order']['status_history'])), "Historique et statut de la commande #$orderNumber consultés");

// --- 10. Déposer un avis («extend» Passer commande) ---
$reviewReq = request('POST', '/reviews', [
    'product_id' => $firstProduct['id'] ?? 1,
    'rating' => 5,
    'comment' => 'Excellent produit, livraison rapide et conforme à la description !',
], $clientToken);
$reviewId = $reviewReq['data']['review']['id'] ?? null;
recordResult("Déposer un avis", "Client", $reviewReq['code'] === 201 && $reviewId !== null, "Avis 5 étoiles enregistré (ID: $reviewId), en attente de modération");

// --- 11. Côté Vendeur : Gérer ses produits ---
$newProd = request('POST', '/vendor/products', [
    'category_id' => $firstProduct['category_id'] ?? 1,
    'name' => 'Produit Test Vendeur ' . uniqid(),
    'price' => 199.00,
    'description' => 'Description test vendeur',
    'variants' => [
        ['sku' => 'SKU-' . uniqid(), 'size' => 'M', 'color' => 'Bleu', 'price' => 199.00, 'stock' => 20],
    ],
    'images' => [
        ['path' => 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'],
    ],
], $vendorToken);
$vendorProdId = $newProd['data']['product']['id'] ?? null;
recordResult("Gérer ses produits", "Vendeur", $newProd['code'] === 201 && $vendorProdId !== null, "Nouveau produit créé en statut BROUILLON (ID: $vendorProdId)");

// --- 12. Côté Vendeur : Soumettre produit ---
$submitProd = request('POST', "/vendor/products/$vendorProdId/submit", null, $vendorToken);
recordResult("Soumettre produit", "Vendeur", $submitProd['code'] === 200 && ($submitProd['data']['product']['status'] ?? '') === 'EN_ATTENTE', "Produit soumis à l'administration (Statut: EN_ATTENTE)");

// --- 13. Côté Vendeur : Gérer ses stocks ---
$stocks = request('GET', '/vendor/stocks', null, $vendorToken);
$stockId = $stocks['data'][0]['stock_id'] ?? 1;
$updateStock = request('PUT', "/vendor/stocks/$stockId", [
    'delta' => 10,
    'reason' => 'Réapprovisionnement fournisseur',
], $vendorToken);
recordResult("Gérer ses stocks", "Vendeur", $updateStock['code'] === 200, "Stock ID $stockId augmenté de 10 unités avec mouvement tracé");

// --- 14. Côté Vendeur : Traiter commandes ---
$vendorOrders = request('GET', '/vendor/orders', null, $vendorToken);
$subOrderId = $vendorOrders['data']['data'][0]['id'] ?? 1;
$shipSubOrder = request('PUT', "/vendor/orders/$subOrderId/status", [
    'status' => 'EXPEDIEE',
    'carrier_id' => 1,
    'tracking_number' => 'AMANA-' . strtoupper(uniqid()),
], $vendorToken);
$trackingNum = $shipSubOrder['data']['sub_order']['shipment']['tracking_number'] ?? null;
recordResult("Traiter commandes", "Vendeur", $shipSubOrder['code'] === 200 && $trackingNum !== null, "Sous-commande #$subOrderId passée en EXPEDIEE avec n° de suivi $trackingNum");

// --- 15. Suivre la livraison (Client / Transporteur) ---
if ($trackingNum) {
    $trackDelivery = request('GET', "/shipments/track/$trackingNum");
    recordResult("Suivre la livraison", "Client / Transporteur", $trackDelivery['code'] === 200, "Colis localisé via $trackingNum chez " . ($trackDelivery['data']['carrier'] ?? 'Transporteur'));
}

// --- 16. Côté Vendeur : Voir ses ventes ---
$vendorSales = request('GET', '/vendor/sales/dashboard', null, $vendorToken);
$hasKpis = isset($vendorSales['data']['kpis']['total_sales']);
recordResult("Voir ses ventes", "Vendeur", $vendorSales['code'] === 200 && $hasKpis, "Tableau de bord vendeur: CA " . ($vendorSales['data']['kpis']['total_sales'] ?? 0) . " MAD, Gains nets " . ($vendorSales['data']['kpis']['net_earnings'] ?? 0) . " MAD");

// --- 17. Traiter réclamation (Client -> Agent de support) ---
$complaintReq = request('POST', '/complaints', [
    'order_id' => $orderId,
    'subject' => 'Question sur la livraison',
    'description' => 'Je souhaite confirmer le créneau horaire de livraison à Casablanca.',
], $clientToken);
$complaintId = $complaintReq['data']['complaint']['id'] ?? null;

$resolveComplaint = request('PUT', "/support/complaints/$complaintId", [
    'status' => 'resolue',
], $supportToken);
recordResult("Traiter réclamation", "Client & Agent de support", $complaintReq['code'] === 201 && $resolveComplaint['code'] === 200, "Réclamation #$complaintId créée par le client et résolue par le support");

// --- 18. Côté Admin : Approuver vendeur ---
$vendors = request('GET', '/admin/vendors', null, $adminToken);
$vId = $vendors['data']['data'][0]['id'] ?? 1;
$approveVendor = request('PUT', "/admin/vendors/$vId/approve", null, $adminToken);
recordResult("Approuver vendeur", "Administrateur", $approveVendor['code'] === 200, "Vendeur ID $vId approuvé (Statut: APPROUVE)");

// --- 19. Côté Admin : Valider un produit ---
$validateProd = request('PUT', "/admin/products/$vendorProdId/validate", null, $adminToken);
recordResult("Valider un produit", "Administrateur", $validateProd['code'] === 200 && ($validateProd['data']['product']['status'] ?? '') === 'PUBLIE', "Produit ID $vendorProdId validé et publié au catalogue");

// --- 20. Côté Admin : Modérer les avis ---
$approveReview = request('PUT', "/admin/reviews/$reviewId/approve", null, $adminToken);
recordResult("Modérer les avis", "Administrateur", $approveReview['code'] === 200 && ($approveReview['data']['review']['status'] ?? '') === 'approuve', "Avis ID $reviewId modéré et approuvé");

// --- 21. Côté Admin : Gérer les coupons ---
$newCoupon = request('POST', '/admin/coupons', [
    'code' => 'SOLDE' . rand(10, 99),
    'type' => 'percentage',
    'value' => 25.00,
    'starts_at' => date('Y-m-d'),
    'expires_at' => date('Y-m-d', strtotime('+3 months')),
    'quota' => 100,
    'per_user_limit' => 1,
], $adminToken);
recordResult("Gérer les coupons", "Administrateur", $newCoupon['code'] === 201, "Nouveau coupon promo créé: " . ($newCoupon['data']['coupon']['code'] ?? ''));

// --- 22. Côté Admin : Gérer commissions & versements ---
$commissions = request('GET', '/admin/commissions', null, $adminToken);
$payoutReq = request('POST', "/admin/vendors/$vId/payout", [
    'period_start' => date('Y-m-01'),
    'period_end' => date('Y-m-t'),
], $adminToken);
recordResult("Gérer commissions", "Administrateur", $commissions['code'] === 200 && $payoutReq['code'] === 201, "Commissions calculées et versement généré pour vendeur ID $vId");

// --- 23. Côté Admin : Accéder au tableau de bord ---
$adminDash = request('GET', '/admin/dashboard/stats', null, $adminToken);
$adminKpis = isset($adminDash['data']['metrics']['total_sales']);
recordResult("Accéder au tableau de bord", "Administrateur", $adminDash['code'] === 200 && $adminKpis, "Statistiques consolidées (CA, commandes, vendeurs, avis) affichées");

// --- 24. Côté Admin : Journaliser action ---
$auditLogs = request('GET', '/admin/audit-logs', null, $adminToken);
$hasAuditLogs = !empty($auditLogs['data']['data']);
recordResult("Journaliser action", "Administrateur", $auditLogs['code'] === 200 && $hasAuditLogs, "Journal d'audit contient " . count($auditLogs['data']['data'] ?? []) . " action(s) tracée(s)");

// --- 25. Prestataire de paiement : Webhook de notification signé (HMAC) ---
$paymentRef = $order['payments'][0]['provider_ref'] ?? null;
if ($paymentRef) {
    $webhookSecret = getenv('PAYMENT_WEBHOOK_SECRET') ?: 'souqly_dev_secret';
    $webhookPayload = [
        'provider_ref' => $paymentRef,
        'status' => 'success',
        'amount' => $order['total'],
    ];
    $signature = hash_hmac('sha256', json_encode($webhookPayload), $webhookSecret);

    $webhook = request('POST', '/payments/webhook', $webhookPayload, null, [
        'X-Signature: ' . $signature,
    ]);
    recordResult("Choisir paiement (Webhook)", "Prestataire de paiement", $webhook['code'] === 200 && ($webhook['data']['payment_status'] ?? '') === 'PAYE', "Notification paiement signée reçue, statut commande mis à jour");
}

echo "\n====================================================================\n";
$total = count($results);
$passed = count(array_filter($results, fn($r) => $r['status'] === 'PASS'));
$failed = $total - $passed;
echo "RESULTAT FINAL: $passed / $total use cases reussis ($failed echec(s))\n";
echo "====================================================================\n";

