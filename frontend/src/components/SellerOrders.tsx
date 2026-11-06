import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Inbox, Truck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorApi, tracking } from '../api';
import { ApiError } from '../api/client';
import {
  orderStatusLabel,
  orderStatusClass,
  NEXT_SUB_ORDER_STATUS,
  price as numPrice,
} from '../api/mapping';
import type { CarrierApi, VendorOrderApi } from '../api/types';
import { formatMAD } from '../utils/format';

const ALL_STATUSES = ['EN_ATTENTE', 'CONFIRMEE', 'EN_PREPARATION', 'EXPEDIEE', 'LIVREE'] as const;

interface ShipModalState {
  subOrder: VendorOrderApi;
}

export default function SellerOrders() {
  const [orders, setOrders] = useState<VendorOrderApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | (typeof ALL_STATUSES)[number]>('all');
  const [updating, setUpdating] = useState<number | null>(null);
  const [shipModal, setShipModal] = useState<ShipModalState | null>(null);

  const loadOrders = () => {
    setLoading(true);
    vendorApi
      .orders()
      .then(setOrders)
      .catch(() => toast.error('Impossible de charger les commandes.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const orderNumber = (order.order?.number ?? String(order.order_id ?? '')).toLowerCase();
      const products = (order.items ?? []).map((i) => i.product_name.toLowerCase()).join(' ');
      const matchesQuery =
        !q ||
        orderNumber.includes(q) ||
        products.includes(q) ||
        (order.shipment?.tracking_number ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [orders, query, statusFilter]);

  const handleStatusChange = async (order: VendorOrderApi, nextStatus: string) => {
    if (nextStatus === order.status) return;

    if (nextStatus === 'EXPEDIEE') {
      setShipModal({ subOrder: order });
      return;
    }

    setUpdating(order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
    try {
      await vendorApi.updateOrderStatus(order.id, nextStatus);
      toast.success(`Commande mise à jour : « ${orderStatusLabel(nextStatus)} ».`);
      loadOrders();
    } catch (error) {
      loadOrders();
      toast.error(
        error instanceof ApiError ? error.message : 'Transition de statut refusée par le backend.',
      );
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-souqly-dark">Gestion des Commandes</h1>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none min-w-[180px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher n°, produit, suivi..."
              aria-label="Rechercher une commande"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-souqly-blue outline-none"
            />
          </div>

          <div className="relative">
            <SlidersHorizontal size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | (typeof ALL_STATUSES)[number])}
              aria-label="Filtrer par statut"
              className="appearance-none pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 cursor-pointer focus:ring-2 focus:ring-souqly-blue outline-none"
            >
              <option value="all">Tous les statuts</option>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="p-4 font-medium">Commande</th>
                <th className="p-4 font-medium">Produits</th>
                <th className="p-4 font-medium">Montant</th>
                <th className="p-4 font-medium">Colis</th>
                <th className="p-4 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400 text-sm">
                    Chargement...
                  </td>
                </tr>
              )}

              {!loading &&
                filtered.map((order) => {
                  const allowed = NEXT_SUB_ORDER_STATUS[order.status] ?? [];
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-souqly-dark whitespace-nowrap">
                        {order.order?.number ? `#${order.order.number}` : null}
                        <span className="block text-[11px] text-gray-400 font-normal">
                          Sous-commande #{order.id}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 text-sm">
                        {(order.items ?? []).map((item) => (
                          <span key={item.id} className="block">
                            {item.product_name} (x{item.quantity})
                          </span>
                        ))}
                      </td>
                      <td className="p-4 font-bold text-souqly-dark whitespace-nowrap">
                        {formatMAD(numPrice(order.subtotal))}
                      </td>
                      <td className="p-4 text-xs whitespace-nowrap">
                        {order.shipment ? (
                          <span className="flex items-center gap-1">
                            <Truck size={13} className="text-souqly-blue" />
                            {order.shipment.tracking_number}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <select
                          value={order.status}
                          disabled={updating === order.id || allowed.length === 0}
                          onChange={(e) => void handleStatusChange(order, e.target.value)}
                          aria-label={`Statut de la sous-commande ${order.id}`}
                          className={`border rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-souqly-blue cursor-pointer disabled:opacity-50 ${orderStatusClass(order.status)}`}
                        >
                          <option value={order.status}>{orderStatusLabel(order.status)}</option>
                          {allowed.map((status) => (
                            <option key={status} value={status}>
                              → {orderStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                      <Inbox size={40} className="text-gray-300" />
                      <p className="font-medium">Aucune commande ne correspond à votre recherche.</p>
                      <button
                        onClick={() => {
                          setQuery('');
                          setStatusFilter('all');
                        }}
                        className="text-souqly-blue text-sm font-medium hover:underline"
                      >
                        Réinitialiser les filtres
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {shipModal && <ShipModal entry={shipModal} onClose={() => setShipModal(null) } onShipped={loadOrders} />}
    </div>
  );
}

interface ShipModalProps {
  entry: ShipModalState;
  onClose: () => void;
  onShipped: () => void;
}

function ShipModal({ entry, onClose, onShipped }: ShipModalProps) {
  const { subOrder } = entry;
  const [carriers, setCarriers] = useState<CarrierApi[]>([]);
  const [carrierId, setCarrierId] = useState<number | null>(null);
  const [trackingNumber, setTrackingNumber] = useState(`SOQ-${subOrder.order_id}-${subOrder.id}`);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    tracking
      .carriers()
      .then((list) => {
        if (!cancelled) {
          setCarriers(list);
          setCarrierId(list[0]?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de charger les transporteurs.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (!carrierId) {
      toast.error('Veuillez choisir un transporteur.');
      return;
    }
    if (trackingNumber.trim().length < 4) {
      toast.error('Numéro de suivi trop court.');
      return;
    }
    setBusy(true);
    try {
      await vendorApi.updateOrderStatus(subOrder.id, 'EXPEDIEE', {
        carrier_id: carrierId,
        tracking_number: trackingNumber.trim(),
      });
      toast.success('Commande expédiée ! Le client peut suivre son colis.');
      onShipped();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Impossible d'expédier cette commande.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Expédier la commande"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-souqly-dark flex items-center gap-2">
            <Truck size={20} className="text-souqly-blue" /> Expédier la sous-commande #{subOrder.id}
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <label htmlFor="ship-carrier" className="text-sm font-medium text-gray-700 block mb-2">
          Transporteur
        </label>
        <select
          id="ship-carrier"
          value={carrierId ?? ''}
          onChange={(e) => setCarrierId(Number(e.target.value))}
          disabled={carriers.length === 0}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm mb-4 focus:ring-2 focus:ring-souqly-blue outline-none"
        >
          {carriers.length === 0 && <option value="">Chargement...</option>}
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="ship-tracking" className="text-sm font-medium text-gray-700 block mb-2">
          Numéro de suivi
        </label>
        <input
          id="ship-tracking"
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-5 focus:ring-2 focus:ring-souqly-blue outline-none"
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || carriers.length === 0}
            className="px-5 py-2.5 bg-souqly-blue hover:bg-blue-800 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {busy ? 'Envoi...' : "Confirmer l'expédition"}
          </button>
        </div>
      </div>
    </div>
  );
}
