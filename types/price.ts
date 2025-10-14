export type PriceTableRowComputed = PriceRow & {
  installerGroupMarkupKr: number;
  totalExVat: number;
  totalInclVat: number;
};

export type PriceRow = {
  name: string;
  carpenterCostPerPanel: number;
  installerGroupMarkupPercent: number;
};

export type SupplierRow = {
  attachment?: string;
  description: string;
  priceExVat: number;
};

export type SupplierData = {
  [key: string]: SupplierRow[];
};

export type Suppliers = Record<string, Record<string, SupplierData>>;

export type PriceTable = {
  id: string;
  installer_group_id: string;
  created_at: string;
  updated_at: string;
  prices: Record<string, PriceRow[]>;
  suppliers: Suppliers;
};
