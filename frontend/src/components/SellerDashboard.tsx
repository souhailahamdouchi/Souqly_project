import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, ShoppingBag, Plus, TrendingUp, Wallet, HandCoins, Hourglass } from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { orderStatusLabel, orderStatusClass, price as numPrice } from '../api/mapping';
import type { VendorDashboardApi } from '../api/types';
import { formatMAD } from '../utils/format';
import type { Page } from '../types';

interface SellerDashboardProps {
  onNavigate?: (page: Page) => void;
}

export default function SellerDashboard({ onNavigate }: SellerDashboardProps) {
  const { user } = useAuth();
  const [data, setData] = useState<VendorDashboardApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    vendorApi
      .dashboard()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Impossible de charger le tableau de bord vendeur.');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shopName = user?.vendor?.shop_name ?? user?.name ?? 'Ma boutique';
  const kpis = data?.kpis;

  const cards = kpis
    ? [
        { label: "Chiffre d'affaires", value: formatMAD(numPrice(kpis.total_sales)), icon: TrendingUp, bg: 'bg-blue-50 text-souqly-blue' },
        { label: 'Commandes confirmées', value: String(kpis.total_orders), icon: ShoppingBag, bg: 'bg-orange-50 text-souqly-orange' },
        { label: 'Commissions', value: formatMAD(numPrice(kpis.total_commissions)), icon: HandCoins, bg: 'bg-purple-50 text-purple-600' },
        { label: 'Revenu net', value: formatMAD(numPrice(kpis.net_earnings)), icon: Wallet, bg: 'bg-teal-50 text-teal-600' },
        { label: 'Commandes à traiter', value: String(kpis.pending_orders), icon: Hourglass, bg: 'bg-yellow-50 text-yellow-600' },
        { label: 'Commandes livrées', value: String(kpis.delivered_orders), icon: Package, bg: 'bg-green-50 text-green-600' },
        { label: 'En attente de versement', value: formatMAD(numPrice(kpis.pending_payout)), icon: HandCoins, bg: 'bg-red-50 text-red-500' },
      ]
    : [];

  return (
    <div className="py-8 flex flex-col lg:flex-row gap-8">
      {/* COLONNE GAUCHE : Menu de navigation vendeur (Sidebar) */}
      <aside className="w-full lg:w-1/4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:sticky lg:top-24">
          <div className="mb-6 px-2">
            <h2 className="text-lg font-bold text-souqly-dark">Espace Vendeur</h2>
            <p className="text-xs text-gray-500 truncate">{shopName}</p>
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => onNavigate?.('seller')}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-blue-50 text-souqly-blue rounded-lg font-medium transition-colors cursor-pointer"
            >
              <LayoutDashboard size={20} />
              Tableau de bord
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('seller-products')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:bg-gray-50 hover:text-souqly-dark rounded-lg font-medium transition-colors cursor-pointer"
            >
              <Package size={20} />
              Mes Produits
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('seller-orders')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:bg-gray-50 hover:text-souqly-dark rounded-lg font-medium transition-colors cursor-pointer"
            >
              <ShoppingBag size={20} />
              Commandes
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('add-product')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-600 hover:bg-gray-50 hover:text-souqly-dark rounded-lg font-medium transition-colors cursor-pointer"
            >
              <Plus size={20} />
              Ajouter un produit
            </button>
          </nav>
        </div>
      </aside>

      {/* COLONNE DROITE : Contenu principal */}
      <main className="w-full lg:w-3/4 min-w-0">
        <h1 className="text-2xl font-bold text-souqly-dark mb-6">Vue d'ensemble</h1>

        {loading ? (
          <div className="flex justify-center py-16 text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-souqly-blue" />
          </div>
        ) : !kpis ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
            Statistiques indisponibles pour le moment.
          </div>
        ) : (
          <>
            {/* Cartes de statistiques */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {cards.map((card) => (
                <div key={card.label} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg ${card.bg}`}>
                      <card.icon size={20} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                  <h3 className="text-xl font-bold text-souqly-dark break-words">{card.value}</h3>
                </div>
              ))}
            </div>

            {/* Commandes récentes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-souqly-dark">Commandes récentes</h2>
                <button
                  onClick={() => onNavigate?.('seller-orders')}
                  className="text-sm text-souqly-blue font-medium hover:underline"
                >
                  Voir tout
                </button>
              </div>
              {(kpis.recent_orders ?? []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[560px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-sm">
                        <th className="p-4 font-medium">N° Commande</th>
                        <th className="p-4 font-medium">ID</th>
                        <th className="p-4 font-medium">Date</th>
                        <th className="p-4 font-medium">Montant</th>
                        <th className="p-4 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {kpis.recent_orders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-medium text-souqly-dark">
                            {order.order_number ? `#${order.order_number}` : `— (ID ${order.id})`}
                          </td>
                          <td className="p-4 text-gray-400 text-xs">#{order.id}</td>
                          <td className="p-4 text-gray-600">
                            {new Date(order.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="p-4 font-bold text-souqly-dark">{formatMAD(order.subtotal)}</td>
                          <td className="p-4">
                            <span className={`${orderStatusClass(order.status)} px-2.5 py-1 rounded-full text-xs font-medium`}>
                              {orderStatusLabel(order.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-6 text-sm text-gray-400">Aucune commande pour le moment.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
