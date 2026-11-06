import { useEffect, useState } from 'react';
import {
  Package,
  MapPin,
  User,
  LogOut,
  ChevronRight,
  ChevronDown,
  Loader2,
  Phone,
  Bell,
  MessageSquareWarning,
  Truck,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, orders as ordersApi, complaints as complaintsApi, notifications as notificationsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  orderStatusLabel,
  orderStatusClass,
  price as numPrice,
} from '../api/mapping';
import type { AddressApi, ComplaintApi, NotificationApi, OrderApi } from '../api/types';
import type { Page } from '../types';
import { formatMAD } from '../utils/format';

interface ClientDashboardProps {
  onNavigate?: (page: Page) => void;
}

type Tab = 'orders' | 'addresses' | 'profile' | 'complaints' | 'notifications';

const CANCELLABLE: string[] = ['EN_ATTENTE', 'CONFIRMEE'];

export default function ClientDashboard({ onNavigate }: ClientDashboardProps) {
  const { user, setUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orders, setOrders] = useState<OrderApi[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const [addresses, setAddresses] = useState<AddressApi[]>(user?.addresses ?? []);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ city: '', street: '', phone: '' });
  const [addingAddress, setAddingAddress] = useState(false);

  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [passwords, setPasswords] = useState({ password: '', password_confirmation: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [complaints, setComplaints] = useState<ComplaintApi[]>([]);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaint, setComplaint] = useState({ order_id: '', subject: '', description: '' });
  const [sendingComplaint, setSendingComplaint] = useState(false);

  const [notifications, setNotifications] = useState<NotificationApi[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (user) {
      setAddresses(user.addresses ?? []);
      setProfile({ name: user.name, phone: user.phone ?? '' });
    }
  }, [user?.id]);

  const loadOrders = () => {
    setLoadingOrders(true);
    ordersApi
      .list()
      .then((res) => setOrders(res.items))
      .catch(() => toast.error('Impossible de charger vos commandes.'))
      .finally(() => setLoadingOrders(false));
  };

  const loadComplaints = () => {
    complaintsApi
      .mine()
      .then(setComplaints)
      .catch(() => toast.error('Impossible de charger vos réclamations.'));
  };

  const loadNotifications = () => {
    notificationsApi
      .list()
      .then((res) => {
        setNotifications(res.notifications);
        setUnread(res.unread_count);
      })
      .catch(() => toast.error('Impossible de charger vos notifications.'));
  };

  useEffect(() => {
    loadOrders();
    loadComplaints();
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCancelOrder = async (orderId: number) => {
    setCancelling(orderId);
    try {
      await ordersApi.cancel(orderId);
      toast.success('Commande annulée. Le remboursement sera traité si besoin.');
      loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'annuler cette commande.");
    } finally {
      setCancelling(null);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newAddress.phone.replace(/\s/g, '');
    if (!newAddress.city) return void toast.error('Veuillez choisir une ville.');
    if (newAddress.street.trim().length < 5)
      return void toast.error('Adresse complète requise (min. 5 caractères).');
    if (!/^0[5-7]\d{8}$/.test(phone)) return void toast.error('Numéro marocain invalide (ex: 0612345678).');

    setAddingAddress(true);
    try {
      await auth.addAddress({ city: newAddress.city, street: newAddress.street.trim(), phone });
      const me = await auth.me();
      setAddresses(me.addresses ?? []);
      if (user) setUser({ ...user, addresses: me.addresses });
      setNewAddress({ city: '', street: '', phone: '' });
      setShowAddressForm(false);
      toast.success('Adresse ajoutée.');
    } catch {
      toast.error("Impossible d'ajouter l'adresse.");
    } finally {
      setAddingAddress(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.name.trim().length < 3) return void toast.error('Nom complet requis (3 caractères min.).');
    if (passwords.password && passwords.password !== passwords.password_confirmation)
      return void toast.error('Les mots de passe ne correspondent pas.');

    setSavingProfile(true);
    try {
      const payload: { name: string; phone: string; password?: string; password_confirmation?: string } = {
        name: profile.name.trim(),
        phone: profile.phone.replace(/\s/g, '') || '',
      };
      if (passwords.password) {
        payload.password = passwords.password;
        payload.password_confirmation = passwords.password_confirmation;
      }
      const updated = await auth.updateProfile(payload);
      if (user) setUser({ ...user, ...updated });
      toast.success('Profil mis à jour.');
      setPasswords({ password: '', password_confirmation: '' });
    } catch {
      toast.error('Impossible de mettre à jour votre profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (complaint.subject.trim().length < 3) return void toast.error('Veuillez saisir un sujet.');
    if (complaint.description.trim().length < 10)
      return void toast.error('Décrivez votre réclamation (10 caractères min.).');

    setSendingComplaint(true);
    const payload: { order_id?: number; subject: string; description: string } = {
      subject: complaint.subject.trim(),
      description: complaint.description.trim(),
    };
    if (complaint.order_id) payload.order_id = Number(complaint.order_id);
    try {
      await complaintsApi.create(payload);
      toast.success('Réclamation envoyée. Notre support vous répondra sous 24h.');
      setComplaint({ order_id: '', subject: '', description: '' });
      setShowComplaintForm(false);
      loadComplaints();
    } catch {
      toast.error("Impossible d'envoyer la réclamation.");
    } finally {
      setSendingComplaint(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      toast.error('Impossible de marquer comme lu.');
    }
  };

  const navButtonClass = (active: boolean) =>
    `w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-colors ${
      active ? 'bg-blue-50 text-souqly-blue' : 'text-gray-600 hover:bg-gray-50'
    }`;

  const badge = (count: number) =>
    count > 0 ? (
      <span className="bg-souqly-orange text-white text-[10px] font-bold px-1.5 rounded-full leading-4">
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  const initials =
    (user?.name ?? '')
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  return (
    <div className="py-8 flex flex-col lg:flex-row gap-8">
      {/* COLONNE GAUCHE : Sidebar Client */}
      <aside className="w-full lg:w-1/4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:sticky lg:top-24">
          <div className="mb-6 px-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-souqly-blue rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-souqly-dark truncate">{user?.name}</h2>
              <p className="text-xs text-gray-500">Membre SOUQLY</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setActiveTab('orders')} className={navButtonClass(activeTab === 'orders')}>
              <span className="flex items-center gap-3">
                <Package size={20} /> Mes Commandes
              </span>
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={navButtonClass(activeTab === 'notifications')}
            >
              <span className="flex items-center justify-between gap-3 flex-1 pr-2">
                <span className="flex items-center gap-3">
                  <Bell size={20} /> Notifications
                </span>
                {badge(unread)}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={navButtonClass(activeTab === 'addresses')}
            >
              <span className="flex items-center gap-3">
                <MapPin size={20} /> Mes Adresses
              </span>
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setActiveTab('complaints')}
              className={navButtonClass(activeTab === 'complaints')}
            >
              <span className="flex items-center gap-3">
                <MessageSquareWarning size={20} /> Réclamations
              </span>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setActiveTab('profile')} className={navButtonClass(activeTab === 'profile')}>
              <span className="flex items-center gap-3">
                <User size={20} /> Mon Profil
              </span>
              <ChevronRight size={16} />
            </button>
          </nav>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={async () => {
                await logout();
                onNavigate?.('home');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors"
            >
              <LogOut size={20} /> Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* COLONNE DROITE : Contenu */}
      <main className="w-full lg:w-3/4 min-w-0">
        {/* ONGLET 1 : COMMANDES */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-souqly-dark mb-2">Historique des commandes</h1>

            {loadingOrders ? (
              <div className="flex justify-center py-16 text-gray-500">
                <Loader2 size={28} className="animate-spin text-souqly-blue" />
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Vous n'avez effectué aucune commande pour le moment.
              </div>
            ) : (
              orders.map((order) => {
                const isOpen = expanded === order.id;
                return (
                  <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">
                          Commande <span className="font-bold text-souqly-dark">#{order.number}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Passée le{' '}
                          {new Date(order.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`${orderStatusClass(order.status)} px-3 py-1 rounded-full text-xs font-bold`}>
                          {orderStatusLabel(order.status)}
                        </span>
                        <p className="text-sm font-bold text-souqly-blue mt-1">{formatMAD(numPrice(order.total))}</p>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="p-4 sm:p-6 space-y-5">
                        {/* Paiements */}
                        {order.payments && order.payments.length > 0 && (
                          <div className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-medium text-gray-600">Paiement : </span>
                            {order.payments
                              .map((p) => `${p.method === 'cash_on_delivery' ? 'à la livraison' : p.method} (${p.status})`)
                              .join(', ')}
                          </div>
                        )}

                        {/* Sous-commandes par vendeur */}
                        <div className="space-y-4">
                          {(order.sub_orders ?? []).map((sub) => (
                            <div key={sub.id} className="border border-gray-100 rounded-xl overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2.5 flex flex-wrap justify-between items-center gap-2">
                                <span className="text-sm font-semibold text-souqly-dark">
                                  {sub.vendor?.shop_name ?? `Vendeur #${sub.vendor_id}`}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`${orderStatusClass(sub.status)} px-2.5 py-1 rounded-full text-xs font-bold`}>
                                    {orderStatusLabel(sub.status)}
                                  </span>
                                  <span className="text-xs text-gray-500 font-medium">{formatMAD(numPrice(sub.subtotal))}</span>
                                </div>
                              </div>

                              <ul className="divide-y divide-gray-50">
                                {(sub.items ?? []).map((item) => (
                                  <li key={item.id} className="px-4 py-3 flex flex-wrap justify-between items-center gap-3">
                                    <div className="min-w-0">
                                      <h4 className="font-medium text-souqly-dark text-sm">{item.product_name}</h4>
                                      <p className="text-xs text-gray-400">
                                        {item.sku} × {item.quantity} — {formatMAD(numPrice(item.unit_price))} l'unité
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>

                              {sub.shipment && (
                                <div className="px-4 py-2.5 bg-blue-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                  <Truck size={14} className="text-souqly-blue shrink-0" />
                                  Colis suivi n°{' '}
                                  <span className="font-bold text-souqly-dark">{sub.shipment.tracking_number}</span>
                                  {sub.shipment.carrier && ` — ${sub.shipment.carrier.name}`}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Adresse */}
                        {order.shipping_address && (
                          <div className="text-xs text-gray-500">
                            <span className="font-medium text-gray-600">Livraison : </span>
                            {order.shipping_address.street}, {order.shipping_address.city} —{' '}
                            {order.shipping_address.phone}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : order.id)}
                        className="flex items-center gap-1 text-sm font-medium text-souqly-blue hover:underline"
                      >
                        {isOpen ? 'Masquer les détails' : 'Détails'} <ChevronDown size={14} className={isOpen ? 'rotate-180 transition-transform' : ''} />
                      </button>
                      {CANCELLABLE.includes(order.status) && (
                        <button
                          onClick={() => void handleCancelOrder(order.id)}
                          disabled={cancelling === order.id}
                          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          {cancelling === order.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                          Annuler la commande
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ONGLET 2 : NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">
              Notifications {unread > 0 && <span className="text-sm text-souqly-orange">({unread} non lues)</span>}
            </h1>
            {notifications.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucune notification pour le moment.
              </div>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => {
                  const isUnread = !n.read_at;
                  return (
                    <li
                      key={n.id}
                      className={`bg-white rounded-xl border p-4 flex items-start justify-between gap-4 ${
                        isUnread ? 'border-souqly-blue' : 'border-gray-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-sm ${isUnread ? 'font-semibold text-souqly-dark' : 'text-gray-600'}`}>
                          {n.data?.message ?? 'Notification'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      {isUnread && (
                        <button
                          onClick={() => void handleMarkRead(n.id)}
                          className="text-xs text-souqly-blue hover:underline shrink-0 font-medium"
                        >
                          Marquer comme lu
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ONGLET 3 : ADRESSES */}
        {activeTab === 'addresses' && (
          <div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h1 className="text-2xl font-bold text-souqly-dark">Mes Adresses</h1>
              <button
                onClick={() => setShowAddressForm((v) => !v)}
                className="bg-souqly-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
              >
                {showAddressForm ? 'Fermer' : 'Nouvelle adresse'}
              </button>
            </div>

            {showAddressForm && (
              <form onSubmit={(e) => void handleAddAddress(e)} className="bg-white rounded-xl shadow-sm border border-souqly-blue p-6 mb-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="addr-city" className="text-sm font-medium text-gray-700">
                      Ville
                    </label>
                    <input
                      id="addr-city"
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))}
                      placeholder="Ex: Casablanca"
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="addr-phone" className="text-sm font-medium text-gray-700">
                      Téléphone
                    </label>
                    <input
                      id="addr-phone"
                      type="tel"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Ex: 0612345678"
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="addr-street" className="text-sm font-medium text-gray-700">
                      Adresse complète
                    </label>
                    <input
                      id="addr-street"
                      type="text"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress((p) => ({ ...p, street: e.target.value }))}
                      placeholder="Rue, quartier, numéro..."
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddressForm(false);
                      setNewAddress({ city: '', street: '', phone: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={addingAddress}
                    className="px-4 py-2 bg-souqly-blue text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
                  >
                    {addingAddress ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {addresses.map((a) => (
                <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <h3 className="font-bold text-souqly-dark flex items-center gap-2 min-w-0">
                      <MapPin size={18} className="text-gray-400 shrink-0" />
                      <span className="truncate">{a.city}</span>
                    </h3>
                    {(a.is_default === 1 || a.is_default === true) && (
                      <span className="bg-blue-100 text-souqly-blue text-xs font-bold px-2 py-1 rounded shrink-0">
                        Par défaut
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{a.street}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone size={13} /> {a.phone}
                  </p>
                </div>
              ))}

              {addresses.length === 0 && !showAddressForm && (
                <div className="col-span-full bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
                  Aucune adresse enregistrée. Ajoutez-en une pour accélérer vos commandes.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ONGLET 4 : RECLAMATIONS */}
        {activeTab === 'complaints' && (
          <div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h1 className="text-2xl font-bold text-souqly-dark">Mes Réclamations</h1>
              <button
                onClick={() => setShowComplaintForm((v) => !v)}
                className="bg-souqly-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
              >
                {showComplaintForm ? 'Fermer' : 'Nouvelle réclamation'}
              </button>
            </div>

            {showComplaintForm && (
              <form
                onSubmit={(e) => void handleComplaintSubmit(e)}
                className="bg-white rounded-xl shadow-sm border border-souqly-blue p-6 mb-6 space-y-3"
              >
                <div className="flex flex-col gap-1">
                  <label htmlFor="cmp-order" className="text-sm font-medium text-gray-700">
                    Commande concernée <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <select
                    id="cmp-order"
                    value={complaint.order_id}
                    onChange={(e) => setComplaint((p) => ({ ...p, order_id: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-souqly-blue outline-none"
                  >
                    <option value="">— Aucune commande —</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.number} ({orderStatusLabel(o.status)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="cmp-subject" className="text-sm font-medium text-gray-700">
                    Sujet
                  </label>
                  <input
                    id="cmp-subject"
                    type="text"
                    value={complaint.subject}
                    onChange={(e) => setComplaint((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Ex: Article non reçu"
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="cmp-desc" className="text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="cmp-desc"
                    rows={4}
                    value={complaint.description}
                    onChange={(e) => setComplaint((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Décrivez votre problème en détail..."
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingComplaint}
                    className="px-4 py-2 bg-souqly-blue text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
                  >
                    {sendingComplaint ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}

            {complaints.length === 0 && !showComplaintForm ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucune réclamation. Nous espérons que tout se passe bien !
              </div>
            ) : (
              <ul className="space-y-4">
                {complaints.map((c) => (
                  <li key={c.id} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <span className="font-semibold text-souqly-dark text-sm">{c.subject}</span>
                      <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full capitalize">
                        {c.status}
                      </span>
                    </div>
                    {c.order && (
                      <p className="text-xs text-gray-400 mb-1">Commande concernée : #{c.order.number}</p>
                    )}
                    <p className="text-sm text-gray-600 whitespace-pre-line">{c.description}</p>
                    {c.created_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(c.created_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ONGLET 5 : PROFIL */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
            <h1 className="text-2xl font-bold text-souqly-dark mb-2 border-b border-gray-100 pb-4">Mon Profil</h1>

            <form className="space-y-5 max-w-lg" onSubmit={(e) => void handleSaveProfile(e)}>
              <div className="flex flex-col gap-1">
                <label htmlFor="pf-name" className="text-sm font-medium text-gray-700">
                  Nom complet
                </label>
                <input
                  id="pf-name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="pf-email" className="text-sm font-medium text-gray-700">
                  Adresse e-mail
                </label>
                <input
                  id="pf-email"
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  title="L'e-mail ne peut pas être modifié"
                  className="border border-gray-200 rounded-lg px-4 py-2 bg-gray-50 text-gray-400 outline-none"
                />
                <p className="text-xs text-gray-400">L'adresse e-mail ne peut pas être modifiée.</p>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="pf-phone" className="text-sm font-medium text-gray-700">
                  Numéro de téléphone
                </label>
                <input
                  id="pf-phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                />
              </div>

              <div className="border-t border-gray-100 pt-5 space-y-4">
                <p className="text-sm font-semibold text-gray-700">
                  Changer de mot de passe <span className="text-gray-400 font-normal">(optionnel)</span>
                </p>
                <div className="flex flex-col gap-1">
                  <label htmlFor="pf-pw" className="text-sm font-medium text-gray-700">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="pf-pw"
                    type="password"
                    value={passwords.password}
                    onChange={(e) => setPasswords((p) => ({ ...p, password: e.target.value }))}
                    autoComplete="new-password"
                    placeholder="6 caractères minimum"
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="pf-pw-confirm" className="text-sm font-medium text-gray-700">
                    Confirmer le nouveau mot de passe
                  </label>
                  <input
                    id="pf-pw-confirm"
                    type="password"
                    value={passwords.password_confirmation}
                    onChange={(e) => setPasswords((p) => ({ ...p, password_confirmation: e.target.value }))}
                    autoComplete="new-password"
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="bg-souqly-blue text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-800 transition-colors mt-4 disabled:opacity-50"
              >
                {savingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
