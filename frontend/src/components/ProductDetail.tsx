import { useEffect, useState } from 'react';
import {
  Star,
  Minus,
  Plus,
  ShoppingCart,
  Heart,
  Truck,
  ShieldCheck,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { catalog, reviews as reviewsApi, wishlist } from '../api';
import { productImage, productVariants, price as numPrice } from '../api/mapping';
import type { ProductApi, ReviewApi } from '../api/types';
import { formatMAD } from '../utils/format';
import type { Page } from '../types';

interface ProductDetailProps {
  productId: number | null;
  onNavigate?: (page: Page) => void;
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <div className="flex items-center gap-1" aria-label={`Note ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={18}
          className={star <= filled ? 'fill-souqly-orange text-souqly-orange' : 'fill-gray-200 text-gray-200'}
        />
      ))}
    </div>
  );
}

function DateFr(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ProductDetail({ productId, onNavigate }: ProductDetailProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState<ProductApi | null>(null);
  const [reviews, setReviews] = useState<ReviewApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedImage, setSelectedImage] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);

  // Avis
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sendingReview, setSendingReview] = useState(false);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      catalog.product(productId),
      catalog.productReviews(productId).catch(() => [] as ReviewApi[]),
    ])
      .then(([productData, reviewData]) => {
        if (cancelled) return;
        setProduct(productData);
        setReviews(reviewData);
        setVariantId((productData.variants ?? [])[0]?.id ?? null);
        setFavorite(Boolean(productData.wishlist));
        setQuantity(1);
        setComment('');
        setRating(5);
        setSelectedImage(0);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const gallery = product?.images?.length ? product.images.map((img) => img.path) : [productImage(product)];
  const variants = product ? productVariants(product) : [];
  const currentVariant = variants.find((v) => v.id === variantId) ?? variants[0] ?? null;

  const effectivePrice = currentVariant?.price || (product ? numPrice(product.promo_price) || numPrice(product.price) : 0);
  const basePrice = product ? numPrice(product.price) : 0;
  const promoPrice = product?.promo_price ? numPrice(product.promo_price) : null;
  const stock = currentVariant?.stock ?? 0;
  const isDiscounted = Boolean(promoPrice && basePrice > promoPrice);
  const discountRate = isDiscounted && promoPrice ? Math.round((1 - promoPrice / basePrice) * 100) : 0;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length
      : 0;

  const selectedVariantStock = product?.variants?.find((v) => v.id === variantId)?.stock?.quantity ?? 0;

  const handleAddToCart = () => {
    if (!variantId) {
      toast.error('Ce produit est indisponible pour le moment.');
      return;
    }
    void addItem({ variantId, stock: selectedVariantStock }, quantity);
  };

  const handleWishlist = async () => {
    if (!user) {
      toast('Connectez-vous pour enregistrer vos favoris.');
      return;
    }
    setFavorite((f) => !f);
    try {
      setFavorite(await wishlist.toggle(Number(productId)));
    } catch {
      setFavorite((f) => !f);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !user) {
      toast('Connectez-vous pour déposer un avis.');
      return;
    }
    if (!comment.trim()) {
      toast.error('Veuillez écrire un commentaire.');
      return;
    }
    setSendingReview(true);
    try {
      await reviewsApi.create({ product_id: product.id, rating, comment: comment.trim() });
      toast.success('Merci ! Votre avis sera publié après validation par notre équipe.');
      setComment('');
      setRating(5);
    } catch {
      toast.error("Impossible d'envoyer votre avis pour le moment.");
    } finally {
      setSendingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-500" aria-live="polite">
        Chargement du produit...
      </div>
    );
  }

  if (!product || notFound) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600 font-medium mb-4">Produit introuvable.</p>
        <button
          type="button"
          onClick={() => onNavigate?.('home')}
          className="bg-souqly-blue text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-800 transition-colors"
        >
          Retour au catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Fil d'Ariane (Breadcrumb) */}
      <div className="text-sm text-gray-500 mb-6 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onNavigate?.('home')}
          className="hover:text-souqly-blue hover:underline transition-colors cursor-pointer flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Accueil
        </button>
        {product.category && (
          <>
            <span>/</span>
            <span className="text-souqly-dark font-medium">{product.category.name_fr}</span>
          </>
        )}
        <span>/</span>
        <span className="text-souqly-dark font-medium truncate max-w-[220px]">{product.name}</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
          {/* COLONNE GAUCHE : Galerie d'images */}
          <div className="min-w-0">
            <div className="bg-gray-50 rounded-xl overflow-hidden mb-4 h-64 sm:h-96 flex items-center justify-center">
              <img
                src={gallery[Math.min(selectedImage, gallery.length - 1)]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-2 sm:gap-4">
                {gallery.slice(0, 4).map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    aria-label={`Voir la photo ${index + 1}`}
                    aria-pressed={selectedImage === index}
                    onClick={() => setSelectedImage(index)}
                    className={`rounded-lg overflow-hidden h-16 sm:h-20 cursor-pointer transition-all ${
                      selectedImage === index
                        ? 'border-2 border-souqly-blue'
                        : 'border border-gray-200 hover:border-souqly-blue'
                    }`}
                  >
                    <img src={src} alt={`Miniature ${index + 1}`} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* COLONNE DROITE : Informations et Achat */}
          <div className="flex flex-col min-w-0">
            <span className="text-souqly-blue font-semibold text-sm mb-2">{product.vendor?.shop_name ?? 'Souqly'}</span>
            <h1 className="text-2xl sm:text-3xl font-bold text-souqly-dark mb-4 leading-tight">{product.name}</h1>

            {/* Notes et Avis */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
              <Stars value={avgRating} />
              <span className="text-sm text-gray-500">
                {reviews.length > 0 ? `${avgRating.toFixed(1)}/5 — ${reviews.length} avis` : 'Aucun avis'}
              </span>
            </div>

            {/* Prix */}
            <div className="flex flex-wrap items-end gap-3 mb-6">
              <span className="text-3xl font-extrabold text-souqly-blue">{formatMAD(effectivePrice)}</span>
              {isDiscounted && promoPrice && (
                <>
                  <span className="text-lg text-gray-400 line-through mb-1">{formatMAD(basePrice)}</span>
                  <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded mb-1">
                    -{discountRate}%
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <p className="text-gray-600 mb-8 leading-relaxed whitespace-pre-line">{product.description}</p>
            )}

            {/* Variantes */}
            {variants.length > 1 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Choisissez votre référence :
                </h3>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={variantId === v.id}
                      title={`Stock : ${v.stock}`}
                      onClick={() => {
                        setVariantId(v.id);
                        setQuantity(1);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                        variantId === v.id
                          ? 'border-souqly-blue bg-blue-50 text-souqly-blue shadow-inner'
                          : `border-gray-300 text-gray-600 hover:border-souqly-blue hover:text-souqly-blue ${
                              v.stock <= 0 ? 'opacity-40 line-through' : ''
                            }`
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock */}
            {stock <= 0 ? (
              <p className="text-sm text-red-500 font-medium mb-4">Rupture de stock</p>
            ) : (
              <p className="text-sm text-green-600 font-medium mb-4">
                En stock ({stock} disponibles{selectedVariantStock !== product?.variants?.[0]?.stock?.quantity ? ' — cette référence' : ''})
              </p>
            )}

            {/* Actions (Quantité + Ajouter au panier) */}
            <div className="flex flex-wrap gap-3 sm:gap-4 mb-8">
              <div className="flex items-center border border-gray-300 rounded-lg bg-gray-50">
                <button
                  type="button"
                  aria-label="Diminuer la quantité"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="p-3 text-gray-500 hover:text-souqly-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus size={18} />
                </button>
                <span className="w-12 text-center font-semibold">{quantity}</span>
                <button
                  type="button"
                  aria-label="Augmenter la quantité"
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  disabled={quantity >= stock}
                  className="p-3 text-gray-500 hover:text-souqly-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={stock <= 0 || !variantId}
                className="flex-1 min-w-[200px] bg-souqly-orange hover:bg-orange-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors py-3 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={20} />
                Ajouter au panier
              </button>

              <button
                type="button"
                aria-label="Ajouter aux favoris"
                aria-pressed={favorite}
                onClick={() => void handleWishlist()}
                className="p-3 border border-gray-300 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-500 transition-colors"
              >
                <Heart size={20} className={favorite ? 'fill-red-500 text-red-500' : ''} />
              </button>
            </div>

            {/* Arguments de confiance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                <Truck size={24} className="text-souqly-blue shrink-0" />
                Livraison 24-48h
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                <ShieldCheck size={24} className="text-souqly-blue shrink-0" />
                Paiement sécurisé
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                <RotateCcw size={24} className="text-souqly-blue shrink-0" />
                Retour sous 14j
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION AVIS CLIENTS --- */}
      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-10">
        <h2 className="text-xl font-bold text-souqly-dark mb-6">Avis clients ({reviews.length})</h2>

        {reviews.length === 0 ? (
          <p className="text-gray-500 text-sm mb-8">Aucun avis publié pour ce produit. Soyez le premier !</p>
        ) : (
          <ul className="space-y-5 mb-8">
            {reviews.map((review) => (
              <li key={review.id} className="border-b border-gray-100 pb-5 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-souqly-dark text-sm">{review.user?.name ?? 'Client'}</span>
                  <span className="text-xs text-gray-400">{DateFr(review.created_at)}</span>
                </div>
                <Stars value={Number(review.rating)} />
                {review.comment && <p className="text-gray-600 text-sm mt-2 whitespace-pre-line">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}

        {/* Formulaire d'avis */}
        {user ? (
          <form onSubmit={(e) => void handleReviewSubmit(e)} className="border-t border-gray-100 pt-6">
            <h3 className="font-semibold text-souqly-dark mb-4">Déposer un avis</h3>
            <div className="flex items-center gap-2 mb-3" role="radiogroup" aria-label="Votre note">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                  aria-checked={rating === star}
                  onClick={() => setRating(star)}
                  className="cursor-pointer transition-transform hover:scale-110"
                >
                  <Star
                    size={26}
                    className={star <= rating ? 'fill-souqly-orange text-souqly-orange' : 'fill-gray-200 text-gray-200'}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500">{rating}/5</span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Partagez votre expérience avec ce produit..."
              aria-label="Votre commentaire"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-souqly-blue resize-none"
            />
            <button
              type="submit"
              disabled={sendingReview}
              className="mt-3 bg-souqly-blue hover:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {sendingReview ? 'Envoi...' : 'Publier mon avis'}
            </button>
            <p className="text-xs text-gray-400 mt-2">Les avis sont publiés après modération par l'administration.</p>
          </form>
        ) : (
          <p className="border-t border-gray-100 pt-6 text-sm text-gray-500">
            <button
              type="button"
              onClick={() => onNavigate?.('auth')}
              className="text-souqly-blue font-medium hover:underline"
            >
              Connectez-vous
            </button>{' '}
            pour déposer un avis.
          </p>
        )}
      </div>
    </div>
  );
}
