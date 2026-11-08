import type { Variants } from "./variants";

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  old_price: number | null;
  heel: number | null;
  color: string;
  category: string;
  images: string[];
  stock: Record<string, number>;
  featured: boolean;
  active: boolean;
  sort: number;
  created_at: string;
  // admin v2
  sku?: string;
  cost?: number | null;
  low_stock?: number;
  seo_title?: string;
  seo_description?: string;
  updated_at?: string;
  /** colours × sizes (null = simple product: one colour, stock per size) */
  variants?: Variants | null;
  /** images shared by all colours (variant products); `images` is the default colour's view */
  baseImages?: string[];
};

export type OrderItem = {
  productId: number;
  slug: string;
  name: string;
  image: string;
  size: string;
  /** variant colour key and its display name at order time (variant products only) */
  color?: string;
  colorName?: string;
  qty: number;
  price: number;
  /** promotion discount on this row (whole shekels), set when the order is placed */
  discount?: number;
};

export type OrderPromotion = { id: number; name: string; badge: string; discount: number };

export type Order = {
  id: number;
  number: string;
  customer_name: string;
  phone: string;
  email: string;
  city: string;
  street: string;
  apt: string;
  notes: string;
  shipping_method: string;
  payment_method: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  // admin v2
  payment_status?: string;
  tracking?: string;
  discount?: number;
  coupon_code?: string;
  /** automatic promotions (מבצעים): total and breakdown; `discount` above is the coupon only */
  promo_discount?: number;
  promotions?: OrderPromotion[];
};

export type OrderEvent = { id: number; order_id: number; type: string; message: string; actor: string; created_at: string };

export type Customer = {
  id: number;
  phone: string;
  name: string;
  email: string;
  city: string;
  tags: string[];
  notes: string;
  marketing_consent: boolean;
  archived: boolean;
  created_at: string;
  birthday?: string | null; // YYYY-MM-DD
};

export type Coupon = {
  id: number;
  code: string;
  description: string;
  type: "percent" | "fixed" | "shipping";
  value: number;
  min_total: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer: number | null;
  used: number;
  active: boolean;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export type ClubMember = {
  id: number;
  name: string;
  phone: string;
  email: string;
  created_at: string;
};

export type CartItem = OrderItem;
