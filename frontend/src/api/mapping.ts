/**
 * Mapping between API payloads (snake_case, prices as strings) and the
 * unified shapes consumed by the UI components.
 */
import type { ProductApi, OrderApi, CartItemApi } from './types';

export interface UiProduct {
  id: number;
  title: string;
  price: number;
  oldPrice?: number;
  image: string;
  seller: string;
  rating?: number;
  isPromo: boolean;
  stock: number;
  variantId: number | null;
  wishlisted: boolean;
  description?: string;
  categoryName?: string;
  brandName?: string | null;
}

export function price(api: string | number | undefined | null): number {
  const n = typeof api === 'string' ? parseFloat(api) : (api ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function productImage(product: ProductApi | null | undefined): string {
  const first = product?.images?.length ? product.images[0].path : undefined;
  return (
    first ??
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'
  );
}

export function mapProduct(product: ProductApi): UiProduct {
  const promo = product.promo_price ? price(product.promo_price) : undefined;
  return {
    id: product.id,
    title: product.name,
    price: promo ?? price(product.price),
    oldPrice: promo ? price(product.price) : undefined,
    image: productImage(product),
    seller: product.vendor?.shop_name ?? 'Souqly',
    isPromo: Boolean(promo),
    stock: firstVariantStock(product),
    variantId: firstVariantId(product),
    wishlisted: Boolean(product.wishlist),
    description: product.description,
    categoryName: product.category?.name_fr,
    brandName: product.brand?.name ?? null,
  };
}

export function productVariants(product: ProductApi): Array<{ id: number; sku: string; label: string; stock: number; price: number }> {
  return (product.variants ?? []).map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    label: [variant.color, variant.size].filter(Boolean).join(' — ') || variant.sku,
    stock: variant.stock?.quantity ?? 0,
    price: price(variant.price) || price(product.price),
  }));
}

export function firstVariantStock(product: ProductApi): number {
  const stocks = (product.variants ?? []).map((v) => v.stock?.quantity ?? 0);
  if (stocks.length === 0) return 0;
  return stocks.reduce((sum, q) => sum + q, 0);
}

export function firstVariantId(product: ProductApi): number | null {
  const variant = (product.variants ?? [])[0];
  return variant ? variant.id : null;
}

export const ORDER_STATUS_FR: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  EN_PREPARATION: 'En préparation',
  EXPEDIEE: 'Expédiée',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
  REMBOURSEE: 'Remboursée',
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-700',
  CONFIRMEE: 'bg-blue-100 text-blue-700',
  EN_PREPARATION: 'bg-indigo-100 text-indigo-700',
  EXPEDIEE: 'bg-purple-100 text-purple-700',
  LIVREE: 'bg-green-100 text-green-700',
  ANNULEE: 'bg-red-100 text-red-700',
  REMBOURSEE: 'bg-gray-200 text-gray-700',
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_FR[status] ?? status;
}

export function orderStatusClass(status: string): string {
  return ORDER_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
}

export function formatOrderTotal(order: OrderApi): number {
  return price(order.total);
}

export const VENDOR_STATUS_FR: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  APPROUVE: 'Approuvé',
  SUSPENDU: 'Suspendu',
};

/** Next sub-order statuses allowed by the backend state machine.
 *  Must mirror VendorOrderController::updateStatus "allowedFrom" map. */
export const NEXT_SUB_ORDER_STATUS: Record<string, string[]> = {
  EN_ATTENTE: ['CONFIRMEE', 'EN_PREPARATION', 'EXPEDIEE'],
  CONFIRMEE: ['EN_PREPARATION', 'EXPEDIEE', 'LIVREE'],
  EN_PREPARATION: ['EXPEDIEE', 'LIVREE'],
  EXPEDIEE: ['LIVREE'],
  LIVREE: [],
  ANNULEE: [],
  REMBOURSEE: [],
};

export function cartItemToUi(item: CartItemApi): UiCartItem {
  const product = item.variant.product;
  const variantPrice = price(item.variant.price) || price(product.promo_price) || price(product.price);
  return {
    id: item.id,
    variantId: item.variant.id,
    title: product.name,
    image: productImage(product),
    seller: product.vendor?.shop_name ?? 'Souqly',
    price: variantPrice,
    quantity: item.quantity,
    stock: item.variant.stock?.quantity ?? 0,
  };
}

export interface UiCartItem {
  id: number;
  variantId: number;
  seller: string;
  title: string;
  image: string;
  price: number;
  quantity: number;
  stock: number;
}
