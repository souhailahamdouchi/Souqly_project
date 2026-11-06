import { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Upload,
  ChevronDown,
  Loader2,
  RefreshCw,
  StickyNote,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { vendorApi, catalog } from '../api';
import { ApiError } from '../api/client';
import { productImage, productVariants, firstVariantStock } from '../api/mapping';
import type { ProductApi } from '../api/types';
import { formatMAD } from '../utils/format';
import type { Page } from '../types';

interface SellerProductsProps {
  onNavigate?: (page: Page) => void;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  BROUILLON: { label: 'Brouillon', class: 'bg-gray-100 text-gray-600' },
  EN_ATTENTE: { label: 'En attente de validation', class: 'bg-yellow-100 text-yellow-700' },
  PUBLIE: { label: 'Publié', class: 'bg-green-100 text-green-700' },
  REFUSE: { label: 'Refusé', class: 'bg-red-100 text-red-600' },
  DESACTIVE: { label: 'Désactivé', class: 'bg-orange-100 text-orange-600' },
};

export default function SellerProducts({ onNavigate }: SellerProductsProps) {
  const [products, setProducts] = useState<ProductApi[]>([]);
  const [categories, setCategories] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editingStock, setEditingStock] = useState<number | null>(null);
  const [stockDelta, setStockDelta] = useState('1');
  const [busyProduct, setBusyProduct] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    vendorApi
      .products()
      .then(setProducts)
      .catch(() => toast.error('Impossible de charger vos produits.'))
      .finally(() => setLoading(false));

    catalog
      .categories()
      .then((list) => {
        setCategories(Object.fromEntries(list.map((c) => [c.id, c.name_fr])));
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (product: ProductApi) => {
    if (!window.confirm(`Supprimer définitivement « ${product.name} » ?`)) return;
    setBusyProduct(product.id);
    try {
      await vendorApi.deleteProduct(product.id);
      toast.success('Produit supprimé.');
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Suppression impossible.');
    } finally {
      setBusyProduct(null);
    }
  };

  const handleSubmit = async (product: ProductApi) => {
    setBusyProduct(product.id);
    try {
      await vendorApi.submitProduct(product.id);
      toast.success('Produit soumis à la validation de l\'administration.');
      load();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'Soumission impossible (produit déjà soumis ?).',
      );
    } finally {
      setBusyProduct(null);
    }
  };

  const handleStockUpdate = async (product: ProductApi) => {
    const delta = parseInt(stockDelta, 10);
    const variant = (product.variants ?? [])[0];
    if (!variant?.stock) return void toast.error('Aucun stock modifiable sur ce produit.');
    if (!Number.isInteger(delta) || delta === 0)
      return void toast.error('Indiquez un mouvement non nul (+5, -2, ...).');

    setBusyProduct(product.id);
    try {
      await vendorApi.updateStock(variant.stock.id, delta);
      toast.success(`Stock mis à jour (${delta > 0 ? '+' : ''}${delta}).`);
      setEditingStock(null);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Mise à jour du stock impossible.');
    } finally {
      setBusyProduct(null);
    }
  };

  return (
    <div className="py-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-souqly-dark">Mes Produits</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez votre catalogue : stock, suppression et soumission à validation.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-1"
          >
            <RefreshCw size={15} /> Rafraîchir
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('add-product')}
            className="bg-souqly-blue text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-800 flex items-center gap-1"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={30} className="animate-spin text-souqly-blue" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Package size={44} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-4">Vous n'avez encore aucun produit.</p>
          <button
            type="button"
            onClick={() => onNavigate?.('add-product')}
            className="bg-souqly-blue text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-800"
          >
            Créer mon premier produit
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const badge = STATUS_BADGE[product.status] ?? {
              label: product.status,
              class: 'bg-gray-100 text-gray-600',
            };
            const isOpen = openId === product.id;
            const variants = productVariants(product);
            const stock = firstVariantStock(product);
            const canSubmit = product.status === 'BROUILLON';

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4 flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src={productImage(product)}
                    alt={product.name}
                    loading="lazy"
                    className="w-16 h-16 object-cover rounded-lg shrink-0 bg-gray-50"
                  />
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <h3 className="font-semibold text-souqly-dark truncate">{product.name}</h3>
                    <p className="text-xs text-gray-500">
                      {categories[product.category_id] ?? '—'} · {formatMAD(parseFloat(product.price))}
                      {product.promo_price && (
                        <span className="text-souqly-orange font-medium">
                          {' '}
                          → promo {formatMAD(parseFloat(product.promo_price))}
                        </span>
                      )}
                    </p>
                  </div>

                  <span className={`${badge.class} text-xs font-bold px-2.5 py-1 rounded-full shrink-0`}>
                    {badge.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : product.id)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1 text-sm font-medium text-souqly-blue hover:underline shrink-0"
                  >
                    Gérer <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5 space-y-4">
                    {product.description && (
                      <p className="text-sm text-gray-500 whitespace-pre-line">{product.description}</p>
                    )}

                    {/* Variantes + stock */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <StickyNote size={13} /> Variantes &amp; stock
                      </h4>
                      <ul className="space-y-2">
                        {variants.map((v) => {
                          const variant = product.variants?.find((vv) => vv.id === v.id);
                          return (
                            <li
                              key={v.id}
                              className="bg-white border border-gray-100 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <span className="text-gray-700">
                                <span className="font-medium">{v.label}</span>
                                <span className="text-gray-400"> — {v.sku}</span>
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatMAD(v.price)} · {variant?.stock ? `${v.stock} en stock` : '—'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {/* Ajustement de stock rapide */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {editingStock === product.id ? (
                          <>
                            <input
                              type="number"
                              value={stockDelta}
                              onChange={(e) => setStockDelta(e.target.value)}
                              className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-souqly-blue outline-none"
                              placeholder="+5 ou -2"
                              aria-label="Mouvement de stock"
                            />
                            <button
                              type="button"
                              onClick={() => void handleStockUpdate(product)}
                              disabled={busyProduct === product.id}
                              className="bg-souqly-blue text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-800 disabled:opacity-50"
                            >
                              Valider
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStock(null)}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-500">
                              Stock total : <strong>{stock}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStock(product.id);
                                setStockDelta('1');
                              }}
                              className="text-xs font-medium text-souqly-blue hover:underline flex items-center gap-1"
                            >
                              <RefreshCw size={12} /> Ajuster le stock
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-gray-100">
                      {canSubmit ? (
                        <button
                          type="button"
                          onClick={() => void handleSubmit(product)}
                          disabled={busyProduct === product.id}
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {busyProduct === product.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Upload size={14} />
                          )}
                          Soumettre pour publication
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 px-2">
                          {product.status === 'EN_ATTENTE' ? (
                            <>
                              <Clock size={13} /> En attente de validation
                            </>
                          ) : product.status === 'PUBLIE' ? (
                            <>
                              <CheckCircle2 size={13} /> En ligne
                            </>
                          ) : (
                            <>
                              <XCircle size={13} /> Non soumis
                            </>
                          )}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(product)}
                        disabled={busyProduct === product.id}
                        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={15} /> Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
