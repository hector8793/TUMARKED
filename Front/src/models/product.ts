export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceInCents: number;
  stock: number;
  imageUrl: string | null;
  active: boolean;
}

