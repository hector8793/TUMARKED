import type { Product } from '../models/product';
import { resolveApiBaseUrl } from './api-url';

const API_URL = resolveApiBaseUrl(import.meta.env, window.location);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error('No pudimos completar la solicitud.');
  return response.json() as Promise<T>;
}

export const api = {
  listProducts: () => request<Product[]>('/products'),
  createCheckout: (body: CreateCheckoutRequest) =>
    request<CheckoutResponse>('/checkouts', { method: 'POST', body: JSON.stringify(body) }),
  listOrders: () => request<Order[]>('/transactions'),
};

export interface CreateCheckoutRequest {
  productId: string;
  quantity: number;
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: {
    address: string; city: string; department: string;
    postalCode?: string; instructions?: string;
  };
}

export interface Order {
  id: string;
  reference: string;
  status: 'CREATED' | 'PENDING' | 'PROCESSING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'CANCELLED';
  totalInCents: number;
  currency: 'COP';
  createdAt: string;
  customerName: string;
  city: string;
  products: Array<{ name: string; quantity: number }>;
}

export interface CheckoutResponse {
  transactionId: string;
  reference: string;
  status: string;
  amounts: {
    subtotal: number; baseFee: number; deliveryFee: number; total: number; currency: 'COP';
  };
}
