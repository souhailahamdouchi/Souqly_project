/**
 * SOUQLY API — all endpoints, grouped by domain, fully typed.
 */
import http, { setToken, clearSession } from './client';
import type {
  AddressApi,
  AdminStatsApi,
  AdminVendorApi,
  AuditLogApi,
  BrandApi,
  CartApi,
  CarrierApi,
  CategoryApi,
  CommissionApi,
  ComplaintApi,
  CouponApi,
  CouponResultApi,
  NewVendorProduct,
  NotificationApi,
  OrderApi,
  Pagination,
  PayoutApi,
  ProductApi,
  ReviewApi,
  ShippingZoneApi,
  UserApi,
  VendorDashboardApi,
  VendorOrderApi,
  VendorStockApi,
} from './types';

// --- Authentification ----------------------------------------
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  role?: 'client' | 'vendor';
  shop_name?: string;
}

interface AuthenticatedResponse {
  message: string;
  user: UserApi;
  token: string;
}

export const auth = {
  async login(payload: LoginPayload): Promise<AuthenticatedResponse> {
    const res = await http.post<AuthenticatedResponse>('/auth/login', payload);
    setToken(res.token);
    return res;
  },

  async register(payload: RegisterPayload): Promise<AuthenticatedResponse> {
    const res = await http.post<AuthenticatedResponse>('/auth/register', payload);
    setToken(res.token);
    return res;
  },

  async me(): Promise<UserApi> {
    const res = await http.get<{ user: UserApi }>('/auth/me');
    return res.user;
  },

  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout');
    } finally {
      setToken(null);
      clearSession();
    }
  },

  async updateProfile(payload: { name?: string; phone?: string; password?: string; password_confirmation?: string }): Promise<UserApi> {
    const res = await http.put<{ message: string; user: UserApi }>('/auth/profile', payload);
    return res.user;
  },

  async addAddress(payload: { city: string; street: string; phone: string; is_default?: boolean }): Promise<AddressApi> {
    const res = await http.post<{ message: string; address: AddressApi }>('/auth/address', payload);
    return res.address;
  },
};

// --- Catalogue ------------------------------------------------
export interface CatalogQuery {
  [key: string]: string | number | boolean | undefined;
  search?: string;
  category?: string | number;
  brand_id?: number;
  min_price?: number;
  max_price?: number;
  sort?: 'price' | 'created_at' | 'name';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export const catalog = {
  async products(query: CatalogQuery = {}): Promise<{ items: ProductApi[]; total: number; perPage: number; currentPage: number }> {
    const res = await http.get<Pagination<ProductApi>>('/catalog/products', query);
    return {
      items: res.data,
      total: res.total ?? res.data.length,
      perPage: res.per_page ?? 12,
      currentPage: res.current_page ?? 1,
    };
  },

  async product(idOrSlug: string | number): Promise<ProductApi> {
    const res = await http.get<{ product: ProductApi }>(`/catalog/products/${idOrSlug}`);
    return res.product;
  },

  async categories(): Promise<CategoryApi[]> {
    return http.get<CategoryApi[]>('/catalog/categories');
  },

  async brands(): Promise<BrandApi[]> {
    return http.get<BrandApi[]>('/catalog/brands');
  },

  async productReviews(productId: number, page = 1): Promise<ReviewApi[]> {
    const res = await http.get<Pagination<ReviewApi>>(`/catalog/products/${productId}/reviews`, { page });
    return res.data;
  },
};

// --- Panier ---------------------------------------------------
export const cartApi = {
  async get(): Promise<CartApi> {
    return http.get<CartApi>('/cart');
  },

  async addItem(productVariantId: number, quantity = 1): Promise<CartApi> {
    await http.post('/cart/items', { product_variant_id: productVariantId, quantity });
    return cartApi.get();
  },

  async updateItem(itemId: number, quantity: number): Promise<CartApi> {
    await http.put(`/cart/items/${itemId}`, { quantity });
    return cartApi.get();
  },

  async removeItem(itemId: number): Promise<void> {
    await http.del(`/cart/items/${itemId}`);
  },

  async clear(): Promise<void> {
    await http.del('/cart/clear');
  },
};

// --- Checkout -------------------------------------------------
export const checkout = {
  async shippingZones(): Promise<ShippingZoneApi[]> {
    return http.get<ShippingZoneApi[]>('/checkout/shipping-zones');
  },

  async applyCoupon(code: string, subtotal: number): Promise<CouponResultApi> {
    return http.post<CouponResultApi>('/checkout/apply-coupon', { code, subtotal });
  },

  async verifyStock(): Promise<{ valid: boolean; message: string }> {
    return http.get<{ valid: boolean; message: string }>('/checkout/verify-stock');
  },

  async placeOrder(payload: {
    shipping_address_id: number;
    shipping_zone_id?: number;
    payment_method: 'cash_on_delivery' | 'card' | 'stripe' | 'cmi';
    coupon_code?: string;
    idempotency_key?: string;
  }): Promise<OrderApi> {
    const res = await http.post<{ message: string; order: OrderApi }>('/checkout/place-order', payload);
    return res.order;
  },
};

// --- Livraison ------------------------------------------------
export const tracking = {
  async carriers(): Promise<CarrierApi[]> {
    return http.get<CarrierApi[]>('/carriers');
  },

  async track(trackingNumber: string): Promise<{
    tracking_number: string;
    status: string;
    carrier: string;
    shipped_at: string | null;
  }> {
    return http.get(`/shipments/track/${encodeURIComponent(trackingNumber)}`);
  },
};

// --- Commandes & avis & wishlist & réclamations ------------------------------------------------
export const orders = {
  async list(page = 1): Promise<{ items: OrderApi[]; total: number }> {
    const res = await http.get<Pagination<OrderApi>>('/orders', { page });
    return { items: res.data, total: res.total ?? res.data.length };
  },

  async detail(orderId: number): Promise<OrderApi> {
    return http.get<OrderApi>(`/orders/${orderId}`);
  },

  async cancel(orderId: number): Promise<OrderApi> {
    const res = await http.post<{ message: string; order: OrderApi }>(`/orders/${orderId}/cancel`);
    return res.order;
  },
};

export const reviews = {
  async create(payload: { product_id: number; rating: number; comment: string }): Promise<void> {
    await http.post('/reviews', payload);
  },
};

export const wishlist = {
  list(): Promise<ProductApi[]> {
    return http.get<ProductApi[]>('/wishlist');
  },

  async toggle(productId: number): Promise<boolean> {
    const res = await http.post<{ in_wishlist: boolean }>(`/wishlist/${productId}/toggle`);
    return res.in_wishlist;
  },
};

export const complaints = {
  async create(payload: { order_id?: number; subject: string; description: string }): Promise<ComplaintApi> {
    const res = await http.post<{ message: string; complaint: ComplaintApi }>('/complaints', payload);
    return res.complaint;
  },

  async mine(): Promise<ComplaintApi[]> {
    const res = await http.get<{ complaints: ComplaintApi[] }>('/complaints/my');
    return res.complaints;
  },

  async all(status?: string): Promise<{ data: ComplaintApi[] }> {
    return http.get<Pagination<ComplaintApi>>('/support/complaints', { status });
  },

  async updateStatus(id: number, status: string, assignee_id?: number): Promise<void> {
    await http.put(`/support/complaints/${id}`, { status, assignee_id });
  },
};

export const notifications = {
  async list(): Promise<{ notifications: NotificationApi[]; unread_count: number }> {
    return http.get('/notifications');
  },

  async markRead(id: number): Promise<void> {
    await http.put(`/notifications/${id}/read`);
  },
};

// --- Vendeur --------------------------------------------------
export const vendorApi = {
  async dashboard(): Promise<VendorDashboardApi> {
    return http.get('/vendor/sales/dashboard');
  },

  async products(): Promise<ProductApi[]> {
    const res = await http.get<Pagination<ProductApi>>('/vendor/products');
    return res.data;
  },

  async createProduct(payload: NewVendorProduct): Promise<ProductApi> {
    const res = await http.post<{ product: ProductApi }>('/vendor/products', payload);
    return res.product;
  },

  async submitProduct(productId: number): Promise<ProductApi> {
    const res = await http.post<{ product: ProductApi }>(`/vendor/products/${productId}/submit`);
    return res.product;
  },

  async deleteProduct(productId: number): Promise<void> {
    await http.del(`/vendor/products/${productId}`);
  },

  async stocks(): Promise<VendorStockApi[]> {
    return http.get('/vendor/stocks');
  },

  async updateStock(stockId: number, delta: number, reason?: string): Promise<void> {
    await http.put(`/vendor/stocks/${stockId}`, { delta, reason });
  },

  async orders(): Promise<VendorOrderApi[]> {
    const res = await http.get<Pagination<VendorOrderApi>>('/vendor/orders');
    return res.data;
  },

  async updateOrderStatus(
    subOrderId: number,
    status: string,
    payload: { carrier_id?: number; tracking_number?: string } = {},
  ): Promise<VendorOrderApi> {
    const res = await http.put<{ message: string; sub_order: VendorOrderApi }>(
      `/vendor/orders/${subOrderId}/status`,
      { status, ...payload },
    );
    return res.sub_order;
  },
};

// --- Admin ----------------------------------------------------
export const adminApi = {
  stats(): Promise<AdminStatsApi> {
    return http.get('/admin/dashboard/stats');
  },

  async vendors(status?: string): Promise<AdminVendorApi[]> {
    const res = await http.get<{ data?: AdminVendorApi[] } | AdminVendorApi[]>('/admin/vendors', { status });
    return Array.isArray(res) ? res : (res.data ?? []);
  },

  approveVendor(id: number): Promise<void> {
    return http.put(`/admin/vendors/${id}/approve`);
  },

  suspendVendor(id: number): Promise<void> {
    return http.put(`/admin/vendors/${id}/suspend`);
  },

  async pendingProducts(): Promise<ProductApi[]> {
    const res = await http.get<Pagination<ProductApi>>('/admin/products/pending');
    return res.data;
  },

  validateProduct(id: number): Promise<void> {
    return http.put(`/admin/products/${id}/validate`);
  },

  rejectProduct(id: number): Promise<void> {
    return http.put(`/admin/products/${id}/reject`);
  },

  async pendingReviews(): Promise<ReviewApi[]> {
    const res = await http.get<Pagination<ReviewApi>>('/admin/reviews/pending');
    return res.data;
  },

  approveReview(id: number): Promise<void> {
    return http.put(`/admin/reviews/${id}/approve`);
  },

  rejectReview(id: number): Promise<void> {
    return http.put(`/admin/reviews/${id}/reject`);
  },

  async coupons(): Promise<{ data: CouponApi[] }> {
    return http.get('/admin/coupons');
  },

  createCoupon(payload: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    starts_at?: string;
    expires_at?: string;
    quota?: number;
    per_user_limit?: number;
  }): Promise<void> {
    return http.post('/admin/coupons', payload);
  },

  updateCoupon(id: number, payload: Partial<CouponApi>): Promise<void> {
    return http.put(`/admin/coupons/${id}`, payload);
  },

  deleteCoupon(id: number): Promise<void> {
    return http.del(`/admin/coupons/${id}`);
  },

  async commissions(status?: string, vendorId?: number): Promise<CommissionApi[]> {
    const res = await http.get<{ data?: CommissionApi[] } | CommissionApi[]>('/admin/commissions', {
      status,
      vendor_id: vendorId,
    });
    return Array.isArray(res) ? res : (res.data ?? []);
  },

  async generatePayout(vendorId: number, period_start: string, period_end: string): Promise<unknown> {
    return http.post(`/admin/vendors/${vendorId}/payout`, { period_start, period_end });
  },

  async payouts(): Promise<PayoutApi[]> {
    const res = await http.get<{ data?: PayoutApi[] } | PayoutApi[]>('/admin/payouts');
    return Array.isArray(res) ? res : (res.data ?? []);
  },

  async auditLogs(): Promise<AuditLogApi[]> {
    const res = await http.get<{ data?: AuditLogApi[] } | AuditLogApi[]>('/admin/audit-logs');
    return Array.isArray(res) ? res : (res.data ?? []);
  },
};
