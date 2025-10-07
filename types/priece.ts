export type PriceRow = {
  name: string;
  carpenterCostPerPanel: number;
  installerGroupMarkupPercent: number;
};

export type PriceTableRowComputed = PriceRow & {
  installerGroupMarkupKr: number;
  totalExVat: number;
  totalInclVat: number;
};

export type PriceTable = {
  id: string;
  installer_group_id: string;
  created_at: string;
  updated_at: string;
  items: Record<string, PriceRow[]>;
};
