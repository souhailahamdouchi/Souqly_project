/* oxlint-disable react/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { ApiError } from '../api/client';
import { cartApi, checkout as checkoutApi } from '../api';
import type { CartItemApi, CouponResultApi } from '../api/types';
import { price } from '../api/mapping';
import { useAuth } from './AuthContext';

export interface UiCartItem {
  id: number;
  variantId: number;
  title: string;
  image: string;
  price: number;
  quantity: number;
  stock: number;
  seller: string;
}

interface AppliedCoupon {
  code: string;
  discount: number;
}

interface CartContextValue {
  items: UiCartItem[];
  count: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  loading: boolean;
  promo: AppliedCoupon | null;
  addItem: (ref: { variantId: number; stock: number }, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: (silent?: boolean) => Promise<void>;
  applyPromo: (code: string) => Promise<boolean>;
  removePromo: () => void;
  setShippingFee: (fee: number) => void;
  reload: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function itemToUi(item: CartItemApi): UiCartItem {
  const product = item.variant?.product;
  const variantPrice = price(item.variant?.price) || price(product?.price);
  return {
    id: item.id,
    variantId: item.product_variant_id,
    title: product?.name ?? 'Article',
    image:
      product?.images?.[0]?.path ??
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
    price: variantPrice,
    quantity: item.quantity,
    stock: item.variant?.stock?.quantity ?? 0,
    seller: product?.vendor?.shop_name ?? 'Souqly',
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<UiCartItem[]>([]);
  const [promo, setPromo] = useState<AppliedCoupon | null>(null);
  const [shipping, setShippingFee] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleError = useCallback((error: unknown) => {
    const message = error instanceof ApiError ? error.message : 'Une erreur est survenue.';
    toast.error(message);
  }, []);

  const fetchCart = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const apiCart = await cartApi.get();
      setItems(apiCart.items.map(itemToUi));
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const reload = fetchCart;

  // Reload the cart from the identity change (login/logout) and on startup
  useEffect(() => {
    void fetchCart();
  }, [user?.id, fetchCart]);

  const addItem = useCallback(
    async (ref: { variantId: number; stock: number }, quantity = 1) => {
      if (!ref.variantId) {
        toast.error('Ce produit est indisponible pour le moment.');
        return;
      }
      if (ref.stock <= 0) {
        toast.error('Ce produit est en rupture de stock.');
        return;
      }
      const existing = items.find((i) => i.variantId === ref.variantId);
      const targetQuantity = Math.min(ref.stock, (existing?.quantity ?? 0) + quantity);

      try {
        const updated = existing
          ? await cartApi.updateItem(existing.id, targetQuantity)
          : await cartApi.addItem(ref.variantId, Math.min(ref.stock, quantity));
        setItems(updated.items.map(itemToUi));
        toast.success('Article ajouté au panier.');
      } catch (error) {
        handleError(error);
      }
    },
    [items, handleError],
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      const previous = items;
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      try {
        await cartApi.removeItem(itemId);
        toast.success('Article retiré du panier.');
      } catch (error) {
        setItems(previous);
        handleError(error);
      }
    },
    [items, handleError],
  );

  const updateQuantity = useCallback(
    async (itemId: number, quantity: number) => {
      if (quantity < 1) {
        await removeItem(itemId);
        return;
      }
      const item = items.find((i) => i.id === itemId);
      const bounded = Math.min(quantity, item?.stock ?? quantity);
      try {
        const updated = await cartApi.updateItem(itemId, bounded);
        setItems(updated.items.map(itemToUi));
      } catch (error) {
        handleError(error);
      }
    },
    [items, removeItem, handleError],
  );

  const clearCart = useCallback(
    async (silent = false): Promise<void> => {
      setItems([]);
      setPromo(null);
      try {
        await cartApi.clear();
        if (!silent) toast.success('Panier vidé.');
      } catch (error) {
        handleError(error);
      }
    },
    [handleError],
  );

  const applyPromo = useCallback(
    async (code: string): Promise<boolean> => {
      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (subtotal <= 0) {
        toast.error('Votre panier est vide.');
        return false;
      }
      try {
        const result: CouponResultApi = await checkoutApi.applyCoupon(code.trim().toUpperCase(), subtotal);
        if (!result.valid) {
          toast.error(result.message ?? 'Code promo invalide ou expiré.');
          return false;
        }
        {
          setPromo({ code: result.code ?? code, discount: Number(result.discount) || 0 });
        }
        toast.success(`Code "${code.trim().toUpperCase()}" appliqué !`);
        return true;
      } catch (error) {
        handleError(error);
        return false;
      }
    },
    [items, handleError],
  );

  const removePromo = useCallback(() => {
    setPromo(null);
    toast.success('Code promo retiré.');
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const discount = promo ? Math.min(promo.discount, subtotal) : 0;
    return {
      items,
      count,
      subtotal,
      discount,
      shipping,
      total: Math.max(0, subtotal - discount) + shipping,
      loading,
      promo,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      applyPromo,
      removePromo,
      setShippingFee,
      reload,
    };
  }, [
    items,
    shipping,
    loading,
    promo,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    applyPromo,
    removePromo,
    setShippingFee,
    reload,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart doit être utilisé dans <CartProvider>');
  return ctx;
}
