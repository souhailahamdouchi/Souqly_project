import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  CreditCard,
  Banknote,
  ShieldCheck,
  Lock,
  ShoppingCart,
  Loader2,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { auth, checkout as checkoutApi } from '../api';
import { ApiError } from '../api/client';
import type { AddressApi, ShippingZoneApi } from '../api/types';
import { formatMAD } from '../utils/format';
import type { Page } from '../types';

interface CheckoutProps {
  onNavigate?: (page: Page) => void;
}

export default function Checkout({ onNavigate }: CheckoutProps) {
  const { items, subtotal, shipping, discount, total, promo, clearCart, setShippingFee, reload } = useCart();
  const { user, setUser } = useAuth();

  const [zones, setZones] = useState<ShippingZoneApi[]>([]);
  const [addresses, setAddresses] = useState<AddressApi[]>(user?.addresses ?? []);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    user?.addresses?.find((a) => a.is_default === 1 || a.is_default === true)?.id ?? user?.addresses?.[0]?.id ?? null,
  );
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ city: '', street: '', phone: '' });
  const [addingAddress, setAddingAddress] = useState(false);
  const [payment, setPayment] = useState<'cash_on_delivery' | 'card'>('cash_on_delivery');
  const [placing, setPlacing] = useState(false);
  const [stockChecked, setStockChecked] = useState<null | { valid: boolean; message: string }>(null);
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  // Zones de livraison
  useEffect(() => {
    let cancelled = false;
    checkoutApi
      .shippingZones()
      .then((list) => {
        if (!cancelled) {
          setZones(list);
          if (list.length > 0) {
            setNewAddress((prev) => (prev.city ? prev : { ...prev, city: list[0].city }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Impossible de charger les villes de livraison.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Adresses à jour depuis le profil
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    auth
      .me()
      .then((me) => {
        if (cancelled) return;
        const list = me.addresses ?? [];
        setAddresses(list);
        const preferred = list.find((a) => a.is_default === 1 || a.is_default === true) ?? list[0] ?? null;
        if (preferred) setSelectedAddressId((current) => current ?? preferred.id);
        else setShowNewAddress(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Frais de livraison par rapport à la ville de l'adresse sélectionnée
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const selectedZone = useMemo(
    () =>
      selectedAddress
        ? zones.find((z) => z.city.toLowerCase().trim() === selectedAddress.city.toLowerCase().trim())
        : null,
    [selectedAddress, zones],
  );

  useEffect(() => {
    if (selectedZone) setShippingFee(parseFloat(selectedZone.fee));
    else setShippingFee(0);
    // Do not reset fee to 0 without zone: the backend validates anyway
  }, [selectedZone, setShippingFee]);

  // Vérification du stock dès l'arrivée sur la page
  useEffect(() => {
    if (!user || items.length === 0) return;
    let cancelled = false;
    checkoutApi
      .verifyStock()
      .then((res) => {
        if (!cancelled) setStockChecked(res);
      })
      .catch(() => {
        if (!cancelled) setStockChecked({ valid: false, message: 'Vérification du stock impossible.' });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, items.length]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const { city, street, phone } = newAddress;
    const cleanPhone = phone.replace(/\s/g, '');
    if (!city) return void toast.error('Veuillez choisir une ville.');
    if (street.trim().length < 5) return void toast.error('Adresse complète requise (min. 5 caractères).');
    if (!/^0[5-7]\d{8}$/.test(cleanPhone)) return void toast.error('Numéro marocain invalide (ex: 0612345678).');

    setAddingAddress(true);
    try {
      await auth.addAddress({ city, street: street.trim(), phone: cleanPhone });
      const me = await auth.me();
      const list = me.addresses ?? [];
      setAddresses(list);
      const created = list[list.length - 1] ?? null;
      if (created) setSelectedAddressId(created.id);
      setShowNewAddress(false);
      setNewAddress({ city: zones[0]?.city ?? '', street: '', phone: '' });
      if (user) setUser({ ...user, addresses: list });
      toast.success('Adresse ajoutée.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Impossible d'ajouter l'adresse.");
    } finally {
      setAddingAddress(false);
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Votre panier est vide.');
      return;
    }
    if (stockChecked && !stockChecked.valid) {
      toast.error(stockChecked.message);
      await reload();
      return;
    }
    if (!selectedAddress) {
      toast.error('Veuillez sélectionner une adresse de livraison.');
      return;
    }
    if (!selectedZone) {
      toast.error(`Livraison indisponible pour « ${selectedAddress.city} ». Choisissez une ville desservie.`);
      return;
    }

    setPlacing(true);
    try {
      const order = await checkoutApi.placeOrder({
        shipping_address_id: selectedAddress.id,
        shipping_zone_id: selectedZone.id,
        payment_method: payment,
        coupon_code: promo?.code,
        idempotency_key: idempotencyKey.current,
      });
      toast.success(`Commande ${order.number} confirmée ! Merci pour votre achat.`);
      idempotencyKey.current = crypto.randomUUID();
      await clearCart(true);
      onNavigate?.('client');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || 'La commande a échoué.');
        if (/stock|rupture|disponib/i.test(error.message)) await reload();
      } else {
        toast.error('La commande a échoué. Réessayez.');
      }
    } finally {
      setPlacing(false);
    }
  };

  // --- États vides ------------------------------------------------
  if (!user) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold text-souqly-dark mb-8">Finaliser la commande</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center text-center gap-4">
          <Lock size={48} className="text-gray-300" />
          <p className="text-gray-600 font-medium">Connectez-vous pour finaliser votre commande.</p>
          <button
            onClick={() => onNavigate?.('auth')}
            className="bg-souqly-blue hover:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Connexion
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold text-souqly-dark mb-8">Finaliser la commande</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center text-center gap-4">
          <ShoppingCart size={48} className="text-gray-300" />
          <p className="text-gray-600 font-medium">Aucun article à commander.</p>
          <button
            onClick={() => onNavigate?.('cart')}
            className="bg-souqly-blue hover:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Retour au panier
          </button>
        </div>
      </div>
    );
  }

  const fieldClass = (invalid: boolean) =>
    `border rounded-lg px-4 py-2 focus:ring-2 focus:ring-souqly-blue focus:outline-none ${
      invalid ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-souqly-dark mb-8">Finaliser la commande</h1>

      {stockChecked && !stockChecked.valid && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span>{stockChecked.message}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg font-medium text-xs"
          >
            Rafraîchir le panier
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* COLONNE GAUCHE : Formulaires */}
        <div className="w-full lg:w-2/3 space-y-6">
          {/* Section 1 : Adresse de livraison */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-2 mb-6 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <MapPin className="text-souqly-blue shrink-0" size={24} />
                <h2 className="text-lg font-bold text-souqly-dark">1. Adresse de livraison</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAddress((v) => !v)}
                className="flex items-center gap-1 text-sm text-souqly-blue font-medium hover:underline"
              >
                <Plus size={16} /> Nouvelle adresse
              </button>
            </div>

            {addresses.length === 0 && !showNewAddress && (
              <p className="text-sm text-gray-500 mb-4">
                Vous n'avez aucune adresse enregistrée. Ajoutez-en une pour continuer.
              </p>
            )}

            <div className="space-y-3">
              {addresses.map((addr) => {
                const zone = zones.find(
                  (z) => z.city.toLowerCase().trim() === addr.city.toLowerCase().trim(),
                );
                return (
                  <label
                    key={addr.id}
                    className={`flex items-start justify-between gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      selectedAddressId === addr.id
                        ? 'border-souqly-blue bg-blue-50'
                        : 'border-gray-200 hover:border-souqly-blue'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 w-4 h-4 text-souqly-blue focus:ring-souqly-blue"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-souqly-dark text-sm">
                          {addr.city}{' '}
                          {(addr.is_default === 1 || addr.is_default === true) && (
                            <span className="text-xs text-souqly-blue font-normal">(par défaut)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{addr.street} — {addr.phone}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium shrink-0 ${
                        zone ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {zone ? formatMAD(parseFloat(zone.fee)) : 'Zone non desservie'}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Formulaire nouvelle adresse */}
            {showNewAddress && (
              <form onSubmit={(e) => void handleAddAddress(e)} className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1 md:col-span-1">
                    <label htmlFor="co-city" className="text-sm font-medium text-gray-700">
                      Ville
                    </label>
                    <select
                      id="co-city"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))}
                      className={`${fieldClass(false)} bg-white`}
                    >
                      {zones.length === 0 && <option value="">Chargement...</option>}
                      {zones.map((z) => (
                        <option key={z.id} value={z.city}>
                          {z.city} ({formatMAD(parseFloat(z.fee))})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="co-phone" className="text-sm font-medium text-gray-700">
                      Téléphone
                    </label>
                    <input
                      id="co-phone"
                      type="tel"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Ex: 0612345678"
                      className={fieldClass(false)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-1">
                    <label htmlFor="co-address" className="text-sm font-medium text-gray-700">
                      Adresse complète
                    </label>
                    <input
                      id="co-address"
                      type="text"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress((p) => ({ ...p, street: e.target.value }))}
                      placeholder="Rue, quartier, numéro..."
                      className={fieldClass(false)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addingAddress}
                  className="mt-4 bg-souqly-blue hover:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {addingAddress ? 'Enregistrement...' : 'Enregistrer cette adresse'}
                </button>
              </form>
            )}
          </div>

          {/* Section 2 : Mode de paiement */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
              <CreditCard className="text-souqly-blue shrink-0" size={24} />
              <h2 className="text-lg font-bold text-souqly-dark">2. Mode de paiement</h2>
            </div>

            <div className="space-y-4">
              {/* Option 1 : Paiement à la livraison */}
              <label
                className={`flex items-center justify-between gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                  payment === 'cash_on_delivery'
                    ? 'border border-souqly-blue bg-blue-50'
                    : 'border border-gray-200 hover:border-souqly-blue'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'cash_on_delivery'}
                    onChange={() => setPayment('cash_on_delivery')}
                    className="w-5 h-5 text-souqly-blue focus:ring-souqly-blue"
                  />
                  <div className="flex items-center gap-2 font-medium text-gray-700">
                    <Banknote size={20} className="text-souqly-blue" />
                    Paiement à la livraison (COD)
                  </div>
                </div>
                {payment === 'cash_on_delivery' && (
                  <CheckCircle2 size={20} className="text-souqly-blue shrink-0" />
                )}
              </label>

              {/* Option 2 : Carte Bancaire */}
              <label
                className={`flex items-center justify-between gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                  payment === 'card'
                    ? 'border border-souqly-blue bg-blue-50'
                    : 'border border-gray-200 hover:border-souqly-blue'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'card'}
                    onChange={() => setPayment('card')}
                    className="w-5 h-5 text-souqly-blue focus:ring-souqly-blue shrink-0"
                  />
                  <div className="flex items-center gap-2 font-medium text-gray-700">
                    <CreditCard size={20} className="text-souqly-blue" />
                    Carte Bancaire (CMI)
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <div className="w-8 h-5 bg-gray-200 rounded"></div>
                  <div className="w-8 h-5 bg-gray-200 rounded"></div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : Résumé */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold text-souqly-dark mb-6">Votre commande</h2>

            <div className="space-y-3 text-sm text-gray-600 mb-6 border-b border-gray-100 pb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden shrink-0">
                      <img src={item.image} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs truncate">{item.title} x{item.quantity}</span>
                  </div>
                  <span className="font-medium shrink-0">{formatMAD(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm text-gray-600 mb-6">
              <div className="flex justify-between gap-4">
                <span>Sous-total</span>
                <span className="font-medium text-souqly-dark">{formatMAD(subtotal)}</span>
              </div>
              {promo && (
                <div className="flex justify-between gap-4 text-green-600">
                  <span>Remise ({promo.code})</span>
                  <span className="font-medium">-{formatMAD(discount)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span>Frais de livraison</span>
                {shipping === 0 ? (
                  <span className="text-green-600 font-medium">Gratuit</span>
                ) : (
                  <span className="font-medium">{formatMAD(shipping)}</span>
                )}
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center mt-3 gap-4">
                <span className="font-bold text-souqly-dark text-base">Total</span>
                <span className="font-extrabold text-souqly-blue text-xl">{formatMAD(total)}</span>
              </div>
            </div>

            <button
              onClick={() => void handleSubmit()}
              disabled={placing}
              className="w-full bg-souqly-orange hover:bg-orange-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-60"
            >
              {placing ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Traitement...
                </>
              ) : (
                <>
                  <Lock size={18} /> Confirmer la commande
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
              <ShieldCheck size={16} className="text-green-500" />
              Vos données sont cryptées et sécurisées
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
