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
};

export type OrderItem = {
  productId: number;
  slug: string;
  name: string;
  image: string;
  size: string;
  qty: number;
  price: number;
};

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
};

export type ClubMember = {
  id: number;
  name: string;
  phone: string;
  email: string;
  created_at: string;
};

export type CartItem = OrderItem;
