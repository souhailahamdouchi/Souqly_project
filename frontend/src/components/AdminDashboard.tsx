import { useEffect, useState } from 'react';
import {
  BarChart3,
  Store,
  Package,
  Star,
  Ticket,
  Percent,
  ScrollText,
  CheckCircle2,
  XCircle,
  ShieldOff,
  Loader2,
  DollarSign,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, complaints } from '../api';
import type {
  AdminStatsApi,
  AdminVendorApi,
  AuditLogApi,
  CommissionApi,
  ComplaintApi,
  CouponApi,
  PayoutApi,
  ProductApi,
  ReviewApi,
} from '../api/types';
import { price as numPrice, orderStatusLabel, orderStatusClass } from '../api/mapping';
import { formatMAD } from '../utils/format';

type Tab = 'stats' | 'vendors' | 'products' | 'reviews' | 'complaints' | 'coupons' | 'commissions' | 'logs';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AdminStatsApi['metrics'] | null>(null);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [vendors, setVendors] = useState<AdminVendorApi[]>([]);
  const [pendingProducts, setPendingProducts] = useState<ProductApi[]>([]);
  const [pendingReviews, setPendingReviews] = useState<ReviewApi[]>([]);
  const [complaintList, setComplaintList] = useState<ComplaintApi[]>([]);
  const [coupons, setCoupons] = useState<CouponApi[]>([]);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'percentage',
    value: '',
    quota: '',
    expires_at: '',
  });
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [commissions, setCommissions] = useState<CommissionApi[]>([]);
  const [payouts, setPayouts] = useState<PayoutApi[]>([]);
  const [payoutForm, setPayoutForm] = useState({ vendor_id: '', period_start: '', period_end: '' });
  const [generatingPayout, setGeneratingPayout] = useState(false);
  const [logs, setLogs] = useState<AuditLogApi[]>([]);

  const loadVendors = () => {
    setLoadingVendors(true);
    Promise.all([adminApi.vendors(), adminApi.stats()])
      .then(([list, s]) => {
        setVendors(list);
        setStats(s.metrics);
      })
      .catch(() => toast.error('Impossible de charger les vendeurs.'))
      .finally(() => setLoadingVendors(false));
  };

  const loadProducts = () => {
    adminApi
      .pendingProducts()
      .then(setPendingProducts)
      .catch(() => toast.error('Impossible de charger les produits en attente.'));
  };

  const loadReviews = () => {
    adminApi
      .pendingReviews()
      .then(setPendingReviews)
      .catch(() => toast.error('Impossible de charger les avis en attente.'));
  };

  const loadComplaints = () => {
    complaints
      .all()
      .then((res) => setComplaintList(res.data))
      .catch(() => toast.error('Impossible de charger les réclamations.'));
  };

  const loadCoupons = () => {
    adminApi
      .coupons()
      .then((res) => setCoupons(res.data))
      .catch(() => toast.error('Impossible de charger les codes promo.'));
  };

  const loadCommissions = () => {
    Promise.all([adminApi.commissions(), adminApi.payouts()])
      .then(([c, p]) => {
        setCommissions(c);
        setPayouts(p);
      })
      .catch(() => toast.error('Impossible de charger les commissions.'));
  };

  const loadLogs = () => {
    adminApi
      .auditLogs()
      .then(setLogs)
      .catch(() => toast.error('Impossible de charger le journal d\'audit.'));
  };

  useEffect(() => {
    // Données globales dès l'ouverture
    loadVendors();
    adminApi
      .stats()
      .then((s) => setStats(s.metrics))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chargement paresseux de l'onglet actif
  useEffect(() => {
    if (tab === 'products') loadProducts();
    if (tab === 'reviews') loadReviews();
    if (tab === 'complaints') loadComplaints();
    if (tab === 'coupons') loadCoupons();
    if (tab === 'commissions') loadCommissions();
    if (tab === 'logs') loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // --- Actions -----------------------------------------------------
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const runAction = async (id: number, promise: () => Promise<unknown>, success: string, refresh: () => void) => {
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      await promise();
      toast.success(success);
      refresh();
    } catch {
      toast.error('Action refusée par le backend.');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponForm.code.trim().toUpperCase();
    if (code.length < 3) return void toast.error('Code trop court (3 caractères min.).');
    const value = parseFloat(couponForm.value);
    if (!Number.isFinite(value) || value <= 0) return void toast.error('Valeur invalide.');

    setCreatingCoupon(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await adminApi.createCoupon({
        code,
        type: couponForm.type as 'percentage' | 'fixed',
        value,
        starts_at: today,
        expires_at: couponForm.expires_at || today,
        quota: couponForm.quota ? parseInt(couponForm.quota, 10) : 100,
        per_user_limit: 1,
      });
      toast.success(`Code « ${code} » créé.`);
      setCouponForm({ code: '', type: 'percentage', value: '', quota: '', expires_at: '' });
      loadCoupons();
    } catch {
      toast.error('Création impossible (code déjà utilisé ?).');
    } finally {
      setCreatingCoupon(false);
    }
  };

  const isCouponActive = (coupon: CouponApi): boolean => {
    const now = Date.now();
    return (
      (!coupon.starts_at || new Date(coupon.starts_at).getTime() <= now) &&
      (!coupon.expires_at || new Date(coupon.expires_at).getTime() >= now)
    );
  };

  const handleDeleteCoupon = async (coupon: CouponApi) => {
    if (!window.confirm(`Supprimer le code « ${coupon.code} » ?`)) return;
    await runAction(
      coupon.id,
      () => adminApi.deleteCoupon(coupon.id),
      'Code supprimé.',
      loadCoupons,
    );
  };

  const handleGeneratePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendorId = parseInt(payoutForm.vendor_id, 10);
    if (!Number.isInteger(vendorId)) return void toast.error('Choisissez un vendeur.');
    if (!payoutForm.period_start || !payoutForm.period_end)
      return void toast.error('Période invalide.');

    setGeneratingPayout(true);
    try {
      await adminApi.generatePayout(vendorId, payoutForm.period_start, payoutForm.period_end);
      toast.success('Versement généré.');
      loadCommissions();
    } catch {
      toast.error('Génération impossible (aucune commission éligible ?).');
    } finally {
      setGeneratingPayout(false);
    }
  };

  const navButtonClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors cursor-pointer ${
      active ? 'bg-blue-50 text-souqly-blue' : 'text-gray-600 hover:bg-gray-50'
    }`;

  const approveButton = 'bg-green-600 hover:bg-green-700 text-white';
  const rejectButton = 'bg-red-100 text-red-600 hover:bg-red-200';

  return (
    <div className="py-8 flex flex-col lg:flex-row gap-8">
      {/* SIDEBAR ADMIN */}
      <aside className="w-full lg:w-1/4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 lg:sticky lg:top-24">
          <div className="mb-6 px-2 flex items-center gap-2">
            <BarChart3 size={22} className="text-souqly-blue" />
            <div>
              <h2 className="text-lg font-bold text-souqly-dark">Administration</h2>
              <p className="text-xs text-gray-500">Pilotage global SOUQLY</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button type="button" onClick={() => setTab('stats')} className={navButtonClass(tab === 'stats')}>
              <Percent size={18} /> Tableau de bord
            </button>
            <button type="button" onClick={() => setTab('vendors')} className={navButtonClass(tab === 'vendors')}>
              <Store size={18} /> Vendeurs
            </button>
            <button type="button" onClick={() => setTab('products')} className={navButtonClass(tab === 'products')}>
              <Package size={18} /> Produits en attente
            </button>
            <button type="button" onClick={() => setTab('reviews')} className={navButtonClass(tab === 'reviews')}>
              <Star size={18} /> Avis à modérer
            </button>
            <button type="button" onClick={() => setTab('complaints')} className={navButtonClass(tab === 'complaints')}>
              <Users size={18} /> Réclamations
            </button>
            <button type="button" onClick={() => setTab('coupons')} className={navButtonClass(tab === 'coupons')}>
              <Ticket size={18} /> Codes promo
            </button>
            <button type="button" onClick={() => setTab('commissions')} className={navButtonClass(tab === 'commissions')}>
              <DollarSign size={18} /> Commissions &amp; versements
            </button>
            <button type="button" onClick={() => setTab('logs')} className={navButtonClass(tab === 'logs')}>
              <ScrollText size={18} /> Journal d'audit
            </button>
          </nav>
        </div>
      </aside>

      {/* CONTENU */}
      <main className="w-full lg:w-3/4 min-w-0 space-y-8">
        {/* DASHBOARD STATS */}
        {tab === 'stats' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Vue d'ensemble</h1>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Ventes totales', value: stats ? formatMAD(numPrice(stats.total_sales)) : '—' },
                { label: 'Commissions', value: stats ? formatMAD(numPrice(stats.total_commissions)) : '—' },
                { label: 'Commandes', value: stats ? String(stats.total_orders) : '—' },
                { label: 'Utilisateurs', value: stats ? String(stats.total_users) : '—' },
                { label: 'Vendeurs actifs', value: stats ? String(stats.active_vendors) : '—' },
                { label: 'Vendeurs en attente', value: stats ? String(stats.pending_vendors) : '—' },
                { label: 'Produits en ligne', value: stats ? String(stats.published_products) : '—' },
                { label: 'Produits à valider', value: stats ? String(stats.pending_products) : '—' },
                { label: 'Avis à modérer', value: stats ? String(stats.pending_reviews) : '—' },
                { label: 'Réclamations ouvertes', value: stats ? String(stats.open_complaints) : '—' },
              ].map((card) => (
                <div key={card.label} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                  <h3 className="text-xl font-bold text-souqly-dark break-words">{card.value}</h3>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <h2 className="text-lg font-bold text-souqly-dark p-6 border-b border-gray-100">Dernières commandes</h2>
              {(stats?.recent_orders ?? []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-sm">
                        <th className="p-4 font-medium">N°</th>
                        <th className="p-4 font-medium">Client</th>
                        <th className="p-4 font-medium">Date</th>
                        <th className="p-4 font-medium">Total</th>
                        <th className="p-4 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats?.recent_orders?.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="p-4 font-medium text-souqly-dark">#{o.number}</td>
                          <td className="p-4 text-gray-600">{o.user?.name ?? '—'}</td>
                          <td className="p-4 text-gray-500 text-sm">
                            {new Date(o.created_at).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                          </td>
                          <td className="p-4 font-bold">{formatMAD(numPrice(o.total))}</td>
                          <td className="p-4">
                            <span className={`${orderStatusClass(o.status)} px-2.5 py-1 rounded-full text-xs font-medium`}>
                              {orderStatusLabel(o.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-6 text-sm text-gray-400">Aucune commande enregistrée.</p>
              )}
            </div>
          </div>
        )}

        {/* VENDEURS */}
        {tab === 'vendors' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Gestion des vendeurs</h1>
            {loadingVendors ? (
              <div className="flex justify-center py-16">
                <Loader2 size={30} className="animate-spin text-souqly-blue" />
              </div>
            ) : vendors.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucun vendeur inscrit.
              </div>
            ) : (
              <div className="space-y-4">
                {vendors.map((v) => {
                  const statusLabel =
                    v.status === 'EN_ATTENTE' ? 'En attente' : v.status === 'APPROUVE' ? 'Approuvé' : 'Suspendu';
                  const statusClass =
                    v.status === 'EN_ATTENTE'
                      ? 'bg-yellow-100 text-yellow-700'
                      : v.status === 'APPROUVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600';
                  const idBusy = pendingIds.has(v.id);
                  return (
                    <div key={v.id} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-souqly-dark">{v.shop_name}</h3>
                        <p className="text-sm text-gray-500">
                          {v.user?.name ?? `Manager #${v.user_id ?? '—'}`} · {v.user?.email ?? ''} · commission{' '}
                          {v.commission_rate}
                        </p>
                      </div>
                      <span className={`${statusClass} px-2.5 py-1 rounded-full text-xs font-bold w-fit shrink-0`}>
                        {statusLabel}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        {v.status !== 'APPROUVE' && (
                          <button
                            type="button"
                            onClick={() =>
                              runAction(v.id, () => adminApi.approveVendor(v.id), `${v.shop_name} approuvé.`, loadVendors)
                            }
                            disabled={idBusy}
                            className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-lg ${approveButton} disabled:opacity-50`}
                          >
                            {idBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Approuver
                          </button>
                        )}
                        {v.status !== 'SUSPENDU' && (
                          <button
                            type="button"
                            onClick={() =>
                              runAction(v.id, () => adminApi.suspendVendor(v.id), `${v.shop_name} suspendu.`, loadVendors)
                            }
                            disabled={idBusy}
                            className={`flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-lg ${rejectButton} disabled:opacity-50`}
                          >
                            <ShieldOff size={15} /> Suspendre
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PRODUITS EN ATTENTE */}
        {tab === 'products' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Produits soumis à validation</h1>
            {pendingProducts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucun produit en attente de validation.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingProducts.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <img
                      src={p.images?.[0]?.path ?? ''}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg bg-gray-50 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-souqly-dark">{p.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatMAD(parseFloat(p.price))}
                        {p.promo_price && ` → promo ${formatMAD(parseFloat(p.promo_price))}`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          runAction(p.id, () => adminApi.validateProduct(p.id), `« ${p.name} » validé et publié.`, loadProducts)
                        }
                        disabled={pendingIds.has(p.id)}
                        className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-lg ${approveButton} disabled:opacity-50`}
                      >
                        {pendingIds.has(p.id) ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                        Valider
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(p.id, () => adminApi.rejectProduct(p.id), `« ${p.name} » rejeté.`, loadProducts)
                        }
                        disabled={pendingIds.has(p.id)}
                        className={`flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-lg ${rejectButton} disabled:opacity-50`}
                      >
                        <XCircle size={15} /> Rejeter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AVIS A MODERER */}
        {tab === 'reviews' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Avis à modérer</h1>
            {pendingReviews.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucun avis en attente de modération.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReviews.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <span className="font-semibold text-souqly-dark text-sm">
                        {r.user?.name ?? 'Client'} — note {r.rating}/5
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runAction(r.id, () => adminApi.approveReview(r.id), 'Avis approuvé et publié.', loadReviews)
                          }
                          disabled={pendingIds.has(r.id)}
                          className={`flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-lg ${approveButton} disabled:opacity-50`}
                        >
                          <CheckCircle2 size={15} /> Approuver
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction(r.id, () => adminApi.rejectReview(r.id), 'Avis rejeté.', loadReviews)
                          }
                          disabled={pendingIds.has(r.id)}
                          className={`flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-lg ${rejectButton} disabled:opacity-50`}
                        >
                          <XCircle size={15} /> Rejeter
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{r.comment}</p>
                    <p className="text-xs text-gray-400 mt-1">Produit #{r.product_id}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RECLAMATIONS */}
        {tab === 'complaints' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Réclamations de la plateforme</h1>
            {complaintList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucune réclamation enregistrée.
              </div>
            ) : (
              <div className="space-y-4">
                {complaintList.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <span className="font-semibold text-souqly-dark text-sm">{c.subject}</span>
                      <select
                        value={c.status}
                        onChange={(e) =>
                          runAction(
                            c.id,
                            () => complaints.updateStatus(c.id, e.target.value),
                            `Réclamation mise à jour (« ${e.target.value} »).`,
                            loadComplaints,
                          )
                        }
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs bg-white cursor-pointer"
                        aria-label="Statut de la réclamation"
                      >
                        {['nouvelle', 'en_cours', 'resolue', 'rejetee'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    {c.order && <p className="text-xs text-gray-400 mb-1">Commande #{c.order.number}</p>}
                    <p className="text-sm text-gray-600 whitespace-pre-line">{c.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COUPONS */}
        {tab === 'coupons' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Codes promo</h1>
            <form
              onSubmit={(e) => void handleCreateCoupon(e)}
              className="bg-white rounded-xl border border-gray-100 p-5 mb-6 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
            >
              <div className="md:col-span-2">
                <label htmlFor="coupon-code" className="text-xs font-medium text-gray-700 block mb-1">
                  Code
                </label>
                <input
                  id="coupon-code"
                  type="text"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="EX: PROMO15"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-souqly-blue outline-none"
                />
              </div>
              <div>
                <label htmlFor="coupon-type" className="text-xs font-medium text-gray-700 block mb-1">
                  Type
                </label>
                <select
                  id="coupon-type"
                  value={couponForm.type}
                  onChange={(e) => setCouponForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (MAD)</option>
                </select>
              </div>
              <div>
                <label htmlFor="coupon-value" className="text-xs font-medium text-gray-700 block mb-1">
                  Valeur
                </label>
                <input
                  id="coupon-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={couponForm.value}
                  onChange={(e) => setCouponForm((p) => ({ ...p, value: e.target.value }))}
                  placeholder="Ex: 10"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-souqly-blue outline-none"
                />
              </div>
              <div>
                <label htmlFor="coupon-quota" className="text-xs font-medium text-gray-700 block mb-1">
                  Quota
                </label>
                <input
                  id="coupon-quota"
                  type="number"
                  min="0"
                  value={couponForm.quota}
                  onChange={(e) => setCouponForm((p) => ({ ...p, quota: e.target.value }))}
                  placeholder="∞"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-souqly-blue outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={creatingCoupon}
                className="bg-souqly-blue hover:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {creatingCoupon ? '...' : 'Créer le code'}
              </button>
            </form>

            {coupons.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucun code promo enregistré.
              </div>
            ) : (
              <div className="space-y-3">
                {coupons.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-bold text-souqly-blue">{c.code}</span>
                      <span className="text-sm text-gray-500">
                        {' '}
                        — {c.type === 'percentage' ? `${c.value}%` : formatMAD(parseFloat(c.value))}
                      </span>
                      <span className="text-xs text-gray-400 block mt-0.5">
                        {isCouponActive(c) ? 'Actif' : 'Inactif'}
                        {c.expires_at ? ` · expire le ${new Date(c.expires_at).toLocaleDateString('fr-FR')}` : ''}
                        {` · ${c.quota ?? '?'} utilisations max`}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleDeleteCoupon(c)}
                        className="text-sm font-medium text-red-500 hover:text-red-700 px-3 py-1.5"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMMISSIONS & PAYOUTS */}
        {tab === 'commissions' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Commissions &amp; versements</h1>

            <form onSubmit={(e) => void handleGeneratePayout(e)} className="bg-white rounded-xl border border-gray-100 p-5 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2">
                <label htmlFor="payout-vendor" className="text-xs font-medium text-gray-700 block mb-1">
                  Vendeur
                </label>
                <select
                  id="payout-vendor"
                  value={payoutForm.vendor_id}
                  onChange={(e) => setPayoutForm((p) => ({ ...p, vendor_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Choisir —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.shop_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="payout-start" className="text-xs font-medium text-gray-700 block mb-1">
                  Début période
                </label>
                <input
                  id="payout-start"
                  type="date"
                  value={payoutForm.period_start}
                  onChange={(e) => setPayoutForm((p) => ({ ...p, period_start: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="payout-end" className="text-xs font-medium text-gray-700 block mb-1">
                  Fin période
                </label>
                <input
                  id="payout-end"
                  type="date"
                  value={payoutForm.period_end}
                  onChange={(e) => setPayoutForm((p) => ({ ...p, period_end: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={generatingPayout || vendors.length === 0}
                className="bg-souqly-blue hover:bg-blue-800 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {generatingPayout ? 'Génération...' : 'Générer le versement'}
              </button>
            </form>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <h2 className="p-4 font-bold text-souqly-dark border-b border-gray-100 text-sm uppercase tracking-wide bg-gray-50">
                  Commissions par commande
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[420px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="p-3 font-medium">Vendeur</th>
                        <th className="p-3 font-medium">Montant</th>
                        <th className="p-3 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {commissions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-gray-400 text-xs">
                            Aucune commission.
                          </td>
                        </tr>
                      ) : (
                        commissions.map((c) => (
                          <tr key={c.id}>
                            <td className="p-3 text-gray-700">{c.vendor?.shop_name ?? `Vendor #${c.vendor_id}`}</td>
                            <td className="p-3 font-bold text-souqly-dark">{formatMAD(parseFloat(c.amount))}</td>
                            <td className="p-3">
                              <span
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  c.status === 'approuve'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <h2 className="p-4 font-bold text-souqly-dark border-b border-gray-100 text-sm uppercase tracking-wide bg-gray-50">
                  Versements (payouts)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[420px]">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="p-3 font-medium">Vendeur</th>
                        <th className="p-3 font-medium">Net</th>
                        <th className="p-3 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {payouts.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-gray-400 text-xs">
                            Aucun versement.
                          </td>
                        </tr>
                      ) : (
                        payouts.map((p) => (
                          <tr key={p.id}>
                            <td className="p-3 text-gray-700">{p.vendor?.shop_name ?? `Vendor #${p.vendor_id}`}</td>
                            <td className="p-3 font-bold text-souqly-dark">{formatMAD(parseFloat(p.net_amount))}</td>
                            <td className="p-3 text-xs text-gray-500 capitalize">{p.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* JOURNAL D'AUDIT */}
        {tab === 'logs' && (
          <div>
            <h1 className="text-2xl font-bold text-souqly-dark mb-6">Journal d'audit</h1>
            {logs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                Aucune action journalisée.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[560px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-sm">
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Utilisateur</th>
                      <th className="p-4 font-medium">Action</th>
                      <th className="p-4 font-medium">Cible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 text-gray-700">{l.user?.name ?? `User #${l.user_id ?? 'système'}`}</td>
                        <td className="p-4">
                          <span className="bg-blue-50 text-souqly-blue text-xs font-bold px-2 py-1 rounded">{l.action}</span>
                        </td>
                        <td className="p-4 text-gray-500 text-xs max-w-[260px] truncate">
                          {JSON.stringify(l.after ?? l.before)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
