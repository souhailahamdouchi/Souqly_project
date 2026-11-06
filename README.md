# SOUQLY — Marketplace marocaine

SOUQLY est une plateforme de marketplace e-commerce « locale » pensée pour le
Maroc : les clients achètent auprès de commerçants vérifiés, les vendeurs
gèrent leur boutique et leurs expéditions, et l'administration opère la
plateforme (validation des vendeurs et produits, commissions, versements,
réclamations, audits).

## Équipe

| Rôle                        | Membre              |
| --------------------------- | ------------------- |
| Développement Frontend      | Hamdouchi Souhaila  |
| Développement Backend (API) | Ouroui Youssef — [@youssefouroui](https://github.com/youssefouroui) |
| Chef de projet / Gestion    | Souiti Hamza        |
| Leader / Tests / Déploiement| Lasly Younes        |
| Conception / Design         | Kourrou Abdelwahab — [@GUURUUU](https://github.com/GUURUUU) |

## Stack technique

- **Backend** — Laravel 12 (PHP 8.4+), API REST sous le préfixe `/api`.
  - Authentification par **tokens Bearer (Sanctum)**.
  - Base de données **SQLite** pour le développement (un fichier
    `database/database.sqlite`), compatible MySQL/MariaDB en production.
  - Tests : PHPUnit — `php artisan test` (61 tests, 216 assertions).

- **Frontend** — React 19 + TypeScript + Vite + Tailwind CSS 4.
  - Routage par état applicatif (`Page`), pas de dépendance externe de
    routing.
  - `react-hot-toast` pour les notifications.

## Démarrage rapide

### 1. Backend (API)

```bash
cd backend
composer install
cp .env.example .env           # puis: touche `php artisan key:generate`
php artisan migrate --seed
php artisan serve              # http://127.0.0.1:8000
```

> **SQLite « could not find driver » ?**
> Si `php -m` n'affiche pas `pdo_sqlite`, installez l'extension
> (`sudo pacman -S php-sqlite`, `sudo apt install php-sqlite3`) **ou**
> créez un fichier ini `php.d/00-sqlite.ini` contenant : `extension=pdo_sqlite`
> + `extension=sqlite3` et lancez PHP avec
> `PHP_INI_SCAN_DIR="/etc/php/conf.d:./php.d"`.

Pour réinitialiser la base de démonstration :

```bash
php artisan migrate:fresh --seed
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev     # http://127.0.0.1:5173
npm run build   # bundle production dans dist/
```

L'URL de l'API est configurée via la variable d'environnement
`VITE_API_URL` (par défaut : `http://127.0.0.1:8000/api`).
Créez `frontend/.env` si nécessaire :

```ini
VITE_API_URL=http://127.0.0.1:8000/api
```

### 3. Comptes de démonstration

| Rôle    | Email            | Mot de passe |
| ------- | ---------------- | ------------ |
| Admin   | admin@souqly.ma  | password123  |
| Vendeur | vendor@souqly.ma | password123  |
| Client  | client@souqly.ma | password123  |

Codes promo de démonstration : `BIENVENUE10` (-10 %), `SOUQLY50`
(-50 MAD), `SOLDE48` (-25 %).

## Fonctionnalités principales

- **Catalogue** : catégories, recherche, produits avec variantes (prix,
  stock, SKU), promotions.
- **Favoris / wishlist** persistés côté serveur.
- **Panier** : fusion automatique du panier invité au login, codes promo,
  frais de livraison par zone.
- **Commandes** : paiement à la livraison ou carte, numéros d'idempotence,
  sous-commandes par vendeur, suivi de colis (transporteur + numéro).
- **Espace vendeur** : tableau de bord (CA, commissions, net), gestion du
  catalogue (brouillon → validation admin → publication), traitement des
  commandes (expédition avec transporteur), versements.
- **Administration** : validation vendeurs/produits/avis, réclamations,
  coupons, commissions & versements, journal d'audit.
- **Tableau client** annule toute commande « En attente / Confirmée ».

## CI / Déploiement

`.github/workflows/ci.yml` exécute à chaque push/PR vers `main` :

- **Backend** : `composer install`, migrations + seeders, `php artisan test`.
- **Frontend** : `npm ci`, build TypeScript + Vite (`npm run build`).

Le fichier `frontend/dist/` est un bundle statique déployable sur n'importe
quel hébergeur (Vercel, Netlify, cPanel…) — pensez alors à définir
`VITE_API_URL` à la construction et à héberger l'API Laravel derrière HTTPS
(`APP_URL` + CORS).

## Licence

[MIT](LICENSE) © Équipe SOUQLY.
