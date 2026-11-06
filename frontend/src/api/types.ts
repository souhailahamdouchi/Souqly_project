// Types of the SOUQLY API (Laravel 12)
// ============================================================
// NOTE: Laravel serializes model relations to snake_case
// (ex: "subOrders" -> "sub_orders") and decimal prices as strings.

export type Language = 'fr' | 'ar' | 'en';

/** Standard Laravel paginator JSON. */
export interface Pagination<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total?: number;
  last_page?: number;
}

export interface RoleApi {
  id: number;
  name: string;
}

export interface VendorApi {
  id: number;
  user_id: number;
  shop_name: string;
  status: string;
  commission_rate: string;
}

export interface AddressApi {
  id: number;
  user_id: number;
  city: string;
  street: string;
  phone: string;
  is_default: number | boolean;
}

export interface UserApi {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  locale: string | null;
  roles: RoleApi[];
  vendor?: VendorApi | null;
  addresses?: AddressApi[];
}

// --- Catalogue -------------------------------------------------
export interface CategoryApi {
  id: number;
  parent_id: number | null;
  name_fr: string;
  name_ar: string | null;
  slug: string;
  is_active: boolean;
  children?: CategoryApi[];
}

export interface BrandApi {
  id: number;
  name: string;
}

export interface ProductImageApi {
  id: number;
  product_id: number;
  path: string;
  position: number | null;
}

export interface StockApi {
  id: number;
  product_variant_id: number;
  quantity: number;
  low_threshold: number;
}

export interface ProductVariantApi {
  id: number;
  product_id: number;
  sku: string;
  size: string | null;
  color: string | null;
  price: string;
  stock?: StockApi | null;
}

export interface ProductApi {
  id: number;
  vendor_id: number;
  category_id: number;
  brand_id: number | null;
  slug: string;
  name: string;
  description: string;
  price: string;
  promo_price: string | null;
  status: string;
  created_at: string;
  category?: CategoryApi;
  brand?: BrandApi;
  wishlist?: { id: number } | null;
  vendor?: { id: number; shop_name: string; user?: UserApi };
  images?: ProductImageApi[];
  variants?: ProductVariantApi[];
}

export interface ReviewApi {
  id: number;
  product_id: number;
  user_id: number;
  rating: number;
  comment: string;
  status: string;
  is_verified: boolean | number;
  created_at: string;
  user?: { id: number; name: string };
}

// --- Panier ----------------------------------------------------
export interface CartItemApi {
  id: number;
  cart_id: number;
  product_variant_id: number;
  quantity: number;
  variant: ProductVariantApi & { product: ProductApi; stock?: StockApi };
}

export interface CartApi {
  cart_id: number;
  items: CartItemApi[];
  total: string | number;
  count: number;
}

// --- Checkout --------------------------------------------------
export interface ShippingZoneApi {
  id: number;
  city: string;
  fee: string;
}

export interface CouponResultApi {
  valid: boolean;
  coupon_id?: number;
  code?: string;
  type?: 'percentage' | 'fixed';
  value?: string | number;
  discount: number | string;
  new_total: number | string;
  message?: string;
}

// --- Commandes -------------------------------------------------
export interface OrderItemApi {
  id: number;
  sub_order_id: number;
  product_variant_id: number;
  quantity: number;
  product_name: string;
  sku: string;
  unit_price: string;
  commission_rate: string;
}

export interface ShipmentApi {
  id: number;
  sub_order_id: number;
  carrier_id: number;
  carrier?: CarrierApi;
  tracking_number: string;
  status: string;
  shipped_at: string | null;
}

export interface CarrierApi {
  id: number;
  name: string;
}

export interface PaymentApi {
  id: number;
  order_id: number;
  method: string;
  status: string;
  amount: string;
  provider_ref: string;
}

export interface SubOrderApi {
  id: number;
  order_id: number;
  vendor_id: number;
  subtotal: string;
  status: string;
  items?: OrderItemApi[];
  vendor?: { id: number; shop_name: string };
  shipment?: ShipmentApi | null;
}

export interface OrderHistoryApi {
  id: number;
  order_id: number;
  from_status: string | null;
  to_status: string;
  action: string | null;
  created_at: string;
}

export interface OrderApi {
  id: number;
  user_id: number;
  number: string;
  subtotal: string;
  shipping_fee: string;
  discount: string | number;
  total: string;
  status: string;
  created_at: string;
  shipping_zone_id: number | null;
  shipping_zone?: ShippingZoneApi;
  shipping_address?: AddressApi;
  sub_orders?: SubOrderApi[];
  payments?: PaymentApi[];
  history?: OrderHistoryApi[];
}

// --- Notifications / Réclamations ------------------------------
export interface NotificationApi {
  id: number;
  user_id: number;
  type: string;
  data: { message?: string; [k: string]: unknown };
  read_at: string | null;
  created_at: string;
}

export interface ComplaintApi {
  id: number;
  user_id: number;
  order_id?: number | null;
  subject: string;
  description: string;
  status: string;
  order?: { id: number; number: string };
  created_at: string;
}

// --- Vendeur ---------------------------------------------------
export interface VendorProductApi {
  product: ProductApi & {
    variants?: ProductVariantApi[];
    images?: ProductImageApi[];
  };
}

export interface VendorStockApi {
  stock_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  low_threshold: number;
  is_low: boolean;
}

export interface VendorOrderApi {
  id: number;
  order_id: number;
  vendor_id: number;
  subtotal: string;
  status: string;
  items?: OrderItemApi[];
  shipment?: ShipmentApi | null;
  created_at: string;
  order?: { id: number; number: string; user?: { name: string } };
}

export interface VendorKpisApi {
  total_sales: number;
  total_commissions: number;
  net_earnings: number;
  pending_payout: number;
  total_orders: number;
  delivered_orders: number;
  pending_orders: number;
}

export interface VendorDashboardApi {
  kpis: VendorKpisApi & { recent_orders: Array<{
    id: number;
    order_number: string | null;
    subtotal: number;
    status: string;
    carrier: string | null;
    tracking_number: string | null;
    created_at: string;
  }> };
}

// --- Admin -----------------------------------------------------
export interface AdminStatsApi {
  metrics: {
    total_sales: string | number;
    total_commissions: string | number;
    total_orders: number;
    total_users: number;
    active_vendors: number;
    pending_vendors: number;
    published_products: number;
    pending_products: number;
    pending_reviews: number;
    open_complaints: number;
    recent_orders?: Array<{
      id: number;
      number: string;
      total: string;
      status: string;
      created_at: string;
      user?: { name: string } | null;
    }>;
  };
}

export interface AdminVendorApi {
  id: number;
  user_id: number | null;
  shop_name: string;
  status: string;
  commission_rate: string;
  created_at: string;
  user?: { id: number; name: string; email: string };
}

export interface CouponApi {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: string;
  starts_at: string | null;
  expires_at: string | null;
  quota: number | null;
  per_user_limit: number | null;
}

export interface CommissionApi {
  id: number;
  vendor_id: number;
  sub_order_id: number;
  rate: string;
  amount: string;
  status: string;
  vendor?: { id: number; shop_name: string };
  created_at: string;
}

export interface PayoutApi {
  id: number;
  vendor_id: number;
  period_start: string;
  period_end: string;
  gross_amount: string;
  commission_total: string;
  refunds_total: string;
  net_amount: string;
  status: string;
  paid_at: string | null;
  vendor?: { id: number; shop_name: string };
}

export interface AuditLogApi {
  id: number;
  user_id: number | null;
  action: string;
  before: unknown;
  after: unknown;
  created_at: string;
  user?: { id: number; name: string } | null;
}

// --- Payload d'un vendeur pour POST /api/vendor/products -------
export interface NewVendorProduct {
  name: string;
  description: string;
  category_id: number;
  price: number;
  promo_price?: number;
  variants: Array<{
    sku: string;
    size?: string;
    color?: string;
    price: number;
    stock: number;
  }>;
  images?: Array<{ path: string }>;
}
