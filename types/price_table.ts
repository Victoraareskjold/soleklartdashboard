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
  category: string;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductSubcategory {
  id: string;
  name: string;
  category_id: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory | null;
  subcategory?: ProductSubcategory | null | null;
  price_ex_vat: number;
  attachment?: string;
  updated_at: string;
  supplier_id: string;
}

export type SupplierWithProducts = Supplier & { products: Product[] };

export interface MountItem {
  id: string;
  supplier_id: string;
  roof_type_id: string;
  price_per: number;
  product: MountProduct;
  roof_type: RoofType;
}

interface MountProduct {
  id: string;
  name: string;
  supplier: MountSupplier;
  price_ex_vat: number;
}

interface MountSupplier {
  id: string;
  name: string;
}

interface RoofType {
  id: string;
  name: string;
}
