import { Product, Supplier } from "@/types/price_table";
import { SupabaseClient } from "@supabase/supabase-js";

export async function getSuppliers(client: SupabaseClient) {
  const { data, error } = await client.from("suppliers").select("id, name");
  if (error) throw error;
  return data as Supplier[];
}

export async function getSuppliersWithProducts(client: SupabaseClient) {
  const { data, error } = await client.from("suppliers").select(`
    id,
    name,
    products (
      id,
      name,
      price_ex_vat,
      attachment,
      updated_at,
      supplier_id,
      category:product_categories(name, id),
      subcategory:product_subcategories(name, id)
    )
  `);
  if (error) throw error;
  return data as unknown as (Supplier & { products: Product[] })[];
}
