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
  index?: number;
}

export interface SupplierCategory {
  name: string;
  markup_percentage: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  index?: number;
}

export interface ProductSubcategory {
  id: string;
  name: string;
  category_id: string;
  index?: number;
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

/**
 * En prislinje i et tilbud — produkt eller montering.
 *
 * `capacityKwh` og `attachmentUrl` er valgfrie: kapasitet er bare relevant
 * for batterier, og produktark finnes ikke på alt.
 */
export type PriceLineItem = {
  id: string;
  name: string;
  supplier: string;
  product: string;
  category: string;
  quantity: number;
  priceWithMarkup: number;
  capacityKwh?: number | null;
  attachmentUrl?: string;
};

export type PriceOverview = {
  suppliers: PriceLineItem[];
  mounting: PriceLineItem[];
  installation: {
    søknad: {
      priceWithMarkup: number;
      attachmentUrl?: string;
    };
    solcelleAnlegg: {
      priceWithMarkup: number;
      attachmentUrl?: string;
    };
    battery: {
      selectedBatteryId: string | null;
      priceWithMarkup: number;
      attachmentUrl?: string;
    };
    additionalCosts: {
      id: string;
      name: string;
      quantity: number;
      priceWithMarkup: number;
      attachmentUrl?: string;
    }[];
  };
  simulationPdfUrl?: string | null;
  total: number;
  "total inkl. alt": number;
  /** Manuell tilbudspris eks. mva som overstyrer summen av linjene. */
  totalOverride?: number | null;
};
