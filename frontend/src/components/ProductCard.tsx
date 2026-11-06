import { useState } from 'react';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { wishlist } from '../api';
import { formatMAD } from '../utils/format';
import type { UiProduct } from '../api/mapping';

interface ProductCardProps {
  product: UiProduct;
  onSelect?: () => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const [favorite, setFavorite] = useState(product.wishlisted);
  const [busy, setBusy] = useState(false);

  const handleAddToCart = () => {
    void addItem({ variantId: product.variantId ?? 0, stock: product.stock }, 1);
  };

  const handleWishlist = async () => {
    if (!user) {
      toast('Connectez-vous pour enregistrer vos favoris.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setFavorite((f) => !f);
    try {
      const inWishlist = await wishlist.toggle(product.id);
      setFavorite(inWishlist);
    } catch {
      setFavorite((f) => !f);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col relative">
      {/* Badge Promo */}
      {product.isPromo && (
        <span className="absolute top-3 left-3 bg-souqly-orange text-white text-xs font-bold px-2 py-1 rounded-md z-10">
          PROMO
        </span>
      )}

      {/* Bouton Favoris (Cœur) */}
      <button
        type="button"
        aria-label={favorite ? `Retirer ${product.title} des favoris` : `Ajouter ${product.title} aux favoris`}
        aria-pressed={favorite}
        onClick={() => void handleWishlist()}
        className="absolute top-3 right-3 bg-white p-2 rounded-full shadow-md text-gray-400 hover:text-red-500 transition-colors z-10"
      >
        <Heart size={18} className={favorite ? 'fill-red-500 text-red-500' : ''} />
      </button>

      {/* Image du produit */}
      <button
        type="button"
        aria-label={`Voir ${product.title}`}
        onClick={onSelect}
        className="relative h-64 overflow-hidden bg-gray-50 block w-full text-left cursor-pointer"
      >
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </button>

      {/* Détails du produit */}
      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-gray-500 mb-1">{product.seller}</p>

        <button
          type="button"
          aria-label={`Voir ${product.title}`}
          onClick={onSelect}
          className="text-left cursor-pointer"
        >
          <h3
            className="font-semibold text-souqly-dark text-sm line-clamp-2 mb-2 flex-1 hover:text-souqly-blue group-hover:text-souqly-blue transition-colors"
            title={product.title}
          >
            {product.title}
          </h3>
        </button>

        <div className="flex items-center gap-1 mb-3">
          <Star size={14} className="fill-souqly-orange text-souqly-orange" />
          <span className="text-xs font-medium text-gray-600">
            {product.categoryName ?? 'Produit'}
          </span>
        </div>

        {/* Prix et Bouton */}
        <div className="flex items-end justify-between mt-auto gap-3">
          <div className="flex flex-col min-w-0">
            {product.oldPrice != null && product.oldPrice > product.price && (
              <span className="text-xs text-gray-400 line-through">{formatMAD(product.oldPrice)}</span>
            )}
            <span className="text-lg font-bold text-souqly-blue break-words">
              {formatMAD(product.price)}
            </span>
          </div>

          <button
            type="button"
            aria-label={`Ajouter ${product.title} au panier`}
            onClick={handleAddToCart}
            disabled={product.stock <= 0 || !product.variantId}
            className="bg-souqly-blue hover:bg-souqly-orange text-white p-2.5 rounded-lg transition-colors duration-300 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingCart size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
