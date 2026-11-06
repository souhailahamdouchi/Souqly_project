import { useEffect, useState } from 'react';
import AppLayout from './components/AppLayout';
import HeroSection from './components/HeroSection';
import CategoriesSection from './components/CategoriesSection';
import ProductCard from './components/ProductCard';
import ProductDetail from './components/ProductDetail';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import SellerDashboard from './components/SellerDashboard';
import SellerProducts from './components/SellerProducts';
import AddProduct from './components/AddProduct';
import AuthPage from './components/AuthPage';
import ClientDashboard from './components/ClientDashboard';
import SellerOrders from './components/SellerOrders';
import AdminDashboard from './components/AdminDashboard';
import StaticPage from './components/StaticPage';
import Loading from './components/Loading';
import { catalog } from './api';
import { mapProduct } from './api/mapping';
import { roleOf } from './context/AuthContext';
import type { UiProduct } from './api/mapping';
import type { CategoryApi, UserApi } from './api/types';
import { useAuth } from './context/AuthContext';
import type { Page } from './types';

function App() {
  const { user, role } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // Catalogues
  const [products, setProducts] = useState<UiProduct[]>([]);
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    let cancelled = false;
    // The loading already in progress is preserved: do not blink on keystrokes
    const timer = setTimeout(() => {
      setCatalogLoading(true);
      catalog
        .products({ search: searchQuery || undefined, category: activeCategory ?? undefined })
        .then((res) => {
          if (!cancelled) {
            setProducts(res.items.map(mapProduct));
            setCatalogError(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCatalogError('Impossible de charger le catalogue. Vérifiez que le backend est démarré.');
          }
        })
        .finally(() => {
          if (!cancelled) setCatalogLoading(false);
        });
    }, activeCategory !== null ? 0 : 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    let cancelled = false;
    catalog
      .categories()
      .then((list) => {
        if (!cancelled) setCategories(list);
      })
      .catch(() => {
        /* non-blocking: sections remain displayed with default values */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openProduct = (productId: number) => {
    setSelectedProductId(productId);
    setCurrentPage('product');
  };

  const performSearch = (query: string) => {
    setSearchQuery(query);
    setActiveCategory(null);
    setCurrentPage('home');
    document.getElementById('produits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAuthSuccess = (loggedUser?: unknown | null) => {
    const candidate = (loggedUser as UserApi | undefined) ?? user;
    const nextRole = roleOf(candidate ?? null);
    if (nextRole === 'vendor') setCurrentPage('seller');
    else if (nextRole === 'admin') setCurrentPage('admin');
    else setCurrentPage('client');
  };

  // Guard: an unauthenticated user is redirected to the login page
  const requireAuth = (allowed: Array<'client' | 'vendor' | 'support' | 'admin' | 'carrier'>, page: Page) => {
    if (!user) {
      return <AuthPage onSuccess={handleAuthSuccess} />;
    }
    if (!allowed.includes(role ?? 'client')) {
      return (
        <div className="py-20 text-center">
          <h1 className="text-xl font-bold text-souqly-dark mb-2">Accès refusé</h1>
          <p className="text-gray-500">Votre compte ne dispose pas des droits nécessaires pour cette section.</p>
        </div>
      );
    }
    switch (page) {
      case 'seller':
        return <SellerDashboard onNavigate={setCurrentPage} />;
      case 'seller-orders':
        return <SellerOrders />;
      case 'seller-products':
        return <SellerProducts onNavigate={setCurrentPage} />;
      case 'add-product':
        return <AddProduct onCancel={() => setCurrentPage('seller-products')} />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return null;
    }
  };

  return (
    <AppLayout onNavigate={setCurrentPage} onSearch={performSearch}>
      {/* --- AFFICHAGE DES PAGES --- */}
      {currentPage === 'home' && (
        <>
          <HeroSection />
          <CategoriesSection
            categories={categories}
            activeCategory={activeCategory}
            onSelect={(slug) => setActiveCategory((prev) => (prev === slug ? null : slug))}
          />
          <div className="py-8 scroll-mt-24" id="produits">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <h1 className="text-2xl font-bold text-souqly-dark">
                {searchQuery || activeCategory ? 'Résultats de recherche' : 'Produits à la une'}
              </h1>
              {(searchQuery || activeCategory) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory(null);
                  }}
                  className="text-sm text-souqly-blue font-medium hover:underline"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>

            {catalogLoading ? (
              <Loading label="Chargement du catalogue..." />
            ) : catalogError ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                <p className="font-medium mb-3">{catalogError}</p>
                <p className="text-sm">
                  L'API Laravel doit tourner sur <code className="bg-gray-100 px-1 rounded">http://127.0.0.1:8000</code>
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucun produit ne correspond à votre recherche pour le moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={() => openProduct(product.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {currentPage === 'product' && (
        <ProductDetail
          productId={selectedProductId}
          onNavigate={setCurrentPage}
        />
      )}
      {currentPage === 'cart' && <Cart onNavigate={setCurrentPage} />}
      {currentPage === 'checkout' && <Checkout onNavigate={setCurrentPage} />}
      {currentPage === 'seller' && requireAuth(['vendor', 'admin'], 'seller')}
      {currentPage === 'seller-orders' && requireAuth(['vendor', 'admin'], 'seller-orders')}
      {currentPage === 'seller-products' && requireAuth(['vendor', 'admin'], 'seller-products')}
      {currentPage === 'add-product' && requireAuth(['vendor', 'admin'], 'add-product')}
      {currentPage === 'admin' && requireAuth(['admin'], 'admin')}
      {currentPage === 'client' && <ClientDashboard onNavigate={setCurrentPage} />}
      {currentPage === 'auth' && <AuthPage onSuccess={handleAuthSuccess} />}
      {currentPage === 'static' && <StaticPage onNavigate={setCurrentPage} />}
    </AppLayout>
  );
}

export default App;
