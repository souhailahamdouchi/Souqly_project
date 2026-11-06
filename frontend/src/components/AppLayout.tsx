import React, { useEffect, useState } from 'react';
import { Globe, ShoppingCart, Sun, Moon, Search, Bell, LogOut, User as UserIcon, LayoutDashboard, ShieldCheck, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { notifications as notificationsApi } from '../api';
import type { Page } from '../types';

type Theme = 'light' | 'dark';

interface AppLayoutProps {
  children: React.ReactNode;
  onNavigate?: (page: Page) => void;
  onSearch?: (query: string) => void;
}

export default function AppLayout({ children, onNavigate, onSearch }: AppLayoutProps) {
  const { lang, changeLanguage, t } = useLanguage();
  const { count } = useCart();
  const { user, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState<number>(0);

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('souqly-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.setProperty('color-scheme', theme);
    try {
      localStorage.setItem('souqly-theme', theme);
    } catch {
      /* storage unavailable: ignoré */
    }
  }, [theme]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    notificationsApi
      .list()
      .then((res) => {
        if (!cancelled) setUnread(res.unread_count);
      })
      .catch(() => {
        /* non-blocking */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Badge synchronisé quand une notification est marquée lue dans l'espace client
  useEffect(() => {
    const onUnreadChange = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === 'number') setUnread(Math.max(0, detail));
    };
    window.addEventListener('souqly:unread-notifications', onUnreadChange);
    return () => window.removeEventListener('souqly:unread-notifications', onUnreadChange);
  }, []);

  // FR -> AR -> EN -> FR
  const handleLanguageCycle = () => {
    if (lang === 'fr') changeLanguage('ar');
    else if (lang === 'ar') changeLanguage('en');
    else changeLanguage('fr');
  };

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    toast.success('Vous êtes déconnecté.');
    onNavigate?.('home');
  };

  const initials = (user?.name ?? '')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const roleLabel =
    role === 'admin'
      ? 'Administration'
      : role === 'vendor'
        ? 'Vendeur'
        : role === 'support'
          ? 'Support'
          : 'Client';

  return (
    <div className="min-h-screen bg-souqly-bg flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <button
            onClick={() => onNavigate?.('home')}
            className="text-xl sm:text-2xl font-bold text-souqly-blue shrink-0 hover:text-blue-800 transition-colors"
          >
            SOUQLY
          </button>

          {/* Recherche catalogue (public) */}
          <form
            className="hidden md:flex flex-1 max-w-xl items-center"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get('q')?.toString() ?? '';
              onSearch?.(value.trim());
            }}
          >
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                name="q"
                placeholder={t('search')}
                aria-label={t('search')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-souqly-blue outline-none"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
              className="flex items-center justify-center text-gray-600 hover:text-souqly-blue border border-gray-200 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={handleLanguageCycle}
              title="Changer de langue"
              className="hidden sm:flex items-center gap-1.5 text-gray-600 hover:text-souqly-blue font-medium transition-colors border border-gray-200 px-2 sm:px-3 py-1.5 rounded-lg shrink-0 text-sm sm:text-base"
            >
              <Globe size={18} />
              {lang.toUpperCase()}
            </button>

            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate?.('client')}
                  title="Notifications et espace client"
                  aria-label="Notifications"
                  className="relative flex items-center justify-center text-gray-600 hover:text-souqly-blue border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <Bell size={18} />
                  {unread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-souqly-orange text-white text-[10px] font-bold px-1.5 rounded-full leading-4">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 border border-gray-200 rounded-lg pl-1.5 pr-2.5 py-1 hover:border-souqly-blue transition-colors"
                  >
                    <span className="w-8 h-8 bg-souqly-blue rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {initials}
                    </span>
                    <span className="hidden lg:block max-w-[140px]">
                      <span className="block text-xs font-semibold text-souqly-dark truncate">{user.name}</span>
                      <span className="block text-[10px] text-gray-500">{roleLabel}</span>
                    </span>
                  </button>

                  {menuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-2 z-50"
                      onMouseLeave={() => setMenuOpen(false)}
                    >
                      {(role === 'vendor' || role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onNavigate?.('seller');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Package size={16} /> Espace vendeur
                        </button>
                      )}
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onNavigate?.('admin');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <ShieldCheck size={16} /> Administration
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onNavigate?.('client');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <UserIcon size={16} /> Espace client
                      </button>
                      {(role === 'vendor' || role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onNavigate?.(role === 'admin' ? 'admin' : 'seller');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 lg:hidden"
                        >
                          <LayoutDashboard size={16} /> Tableau de bord
                        </button>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                      >
                        <LogOut size={16} /> Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => onNavigate?.('auth')}
                className="text-gray-600 font-medium hover:text-souqly-blue transition-colors whitespace-nowrap text-sm sm:text-base shrink-0"
              >
                {t('login')}
              </button>
            )}

            <button
              onClick={() => onNavigate?.('cart')}
              className="flex items-center gap-2 bg-souqly-blue hover:bg-blue-800 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-sm sm:text-base shrink-0"
            >
              <ShoppingCart size={16} className="sm:hidden" />
              <span className="hidden sm:inline">{t('cart')}</span>
              <span className="bg-white text-souqly-blue text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {count}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">{children}</main>

      <footer className="bg-gray-800 text-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; 2026 SOUQLY — Marketplace marocaine Multi-vendeurs</p>
          <nav className="flex items-center gap-5 text-sm text-gray-300">
            <button
              type="button"
              onClick={() => onNavigate?.('static')}
              className="hover:text-white underline-offset-4 hover:underline transition-colors cursor-pointer"
            >
              Conditions Générales de Vente
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('home')}
              className="hover:text-white underline-offset-4 hover:underline transition-colors cursor-pointer"
            >
              Accueil
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
