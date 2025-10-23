export type WorkCategory = "roof" | "electrician" | "additional";

export interface WorkItem {
  id: string;
  category: WorkCategory;
  name: string;
  cost_per: number;
  markup_percent: number;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface ProductCategory {
  id: string;
  supplier_id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price_ex_vat: number;
  attachment?: string;
  updated_at: string;
  supplier_id: string;
}

export type SupplierWithProducts = Supplier & { products: Product[] };
