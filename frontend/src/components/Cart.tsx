import { useMemo, useState } from 'react';
import { Trash2, Minus, Plus, ArrowRight, ShieldCheck, Tag, ShoppingCart, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../context/CartContext';
import type { UiCartItem } from '../context/CartContext';
import { formatMAD } from '../utils/format';
import type { Page } from '../types';

export default function Cart({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const {
    items,
    subtotal,
    shipping,
    discount,
    total,
    promo,
    loading,
    updateQuantity,
    removeItem,
    applyPromo,
    removePromo,
  } = useCart();
  const [promoInput, setPromoInput] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);

  const groupedBySeller = useMemo(() => {
    return items.reduce<Record<string, UiCartItem[]>>((acc, item) => {
      const key = item.seller ?? 'Souqly';
      (acc[key] ??= []).push(item);
      return acc;
    }, {});
  }, [items]);

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) {
      toast.error('Veuillez saisir un code promo.');
      return;
    }
    setPromoBusy(true);
    const ok = await applyPromo(code);
    setPromoBusy(false);
    if (ok) setPromoInput('');
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 size={32} className="animate-spin text-souqly-blue" />
        <p className="text-sm font-medium">Chargement de votre panier...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold text-souqly-dark mb-8">Mon Panier</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center text-center gap-4">
          <ShoppingCart size={48} className="text-gray-300" />
          <p className="text-gray-600 font-medium">Votre panier est vide.</p>
          <button
            onClick={() => onNavigate?.('home')}
            className="bg-souqly-blue hover:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Découvrir les produits
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-souqly-dark mb-8">Mon Panier</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* COLONNE GAUCHE : Liste des articles */}
        <div className="w-full lg:w-2/3 space-y-6">
          {Object.entries(groupedBySeller).map(([seller, sellerItems]) => (
            <div
              key={seller}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* En-tête du vendeur (Multi-vendeurs) */}
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  Vendu par : <span className="font-semibold text-souqly-dark">{seller}</span>
                </span>
              </div>

              {sellerItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 border-b border-gray-100 last:border-b-0"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="w-24 h-24 object-cover rounded-lg shrink-0"
                  />

                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <h3 className="font-semibold text-souqly-dark mb-1 break-words">{item.title}</h3>
                    <p className="text-souqly-blue font-bold">{formatMAD(item.price)}</p>
                    {item.quantity >= item.stock && (
                      <p className="text-xs text-souqly-orange mt-1">
                        Stock maximum atteint ({item.stock} restants)
                      </p>
                    )}
                  </div>

                  {/* Actions (Quantité + Supprimer) */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="flex items-center border border-gray-300 rounded-lg bg-gray-50">
                      <button
                        aria-label="Diminuer la quantité"
                        onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="p-2 text-gray-500 hover:text-souqly-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                      <button
                        aria-label="Augmenter la quantité"
                        onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                        className="p-2 text-gray-500 hover:text-souqly-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <button
                      aria-label={`Supprimer ${item.title}`}
                      onClick={() => void removeItem(item.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* COLONNE DROITE : Résumé de la commande */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold text-souqly-dark mb-6">Résumé de la commande</h2>

            <div className="space-y-3 text-sm text-gray-600 mb-6">
              <div className="flex justify-between gap-4">
                <span>Sous-total</span>
                <span className="font-medium text-souqly-dark">{formatMAD(subtotal)}</span>
              </div>

              {promo && (
                <div className="flex justify-between gap-4 text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag size={14} /> Remise ({promo.code})
                  </span>
                  <span>-{formatMAD(discount)}</span>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <span>Frais de livraison</span>
                <span className="text-green-600 font-medium">
                  {shipping === 0 ? 'Gratuit' : formatMAD(shipping)}
                </span>
              </div>

              <div className="border-t border-gray-100 pt-3 flex justify-between items-center mt-3 gap-4">
                <span className="font-bold text-souqly-dark text-base">Total</span>
                <span className="font-extrabold text-souqly-blue text-xl">{formatMAD(total)}</span>
              </div>
            </div>

            {/* Code Promo */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleApplyPromo()}
                placeholder="Code (ex: SOUQLY50)"
                aria-label="Code promo"
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-souqly-blue"
              />
              <button
                onClick={() => void handleApplyPromo()}
                disabled={promoBusy}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors shrink-0 disabled:opacity-50"
              >
                {promoBusy ? '...' : 'Appliquer'}
              </button>
            </div>
            {promo && (
              <button
                onClick={removePromo}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors -mt-4 mb-4"
              >
                Retirer le code promo
              </button>
            )}

            <button
              onClick={() => onNavigate?.('checkout')}
              className="w-full bg-souqly-orange hover:bg-orange-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              Passer la commande
              <ArrowRight size={20} />
            </button>

            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
              <ShieldCheck size={16} className="text-green-500" />
              Paiement 100% sécurisé
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
