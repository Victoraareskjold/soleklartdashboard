import { Product, Supplier } from "@/types/price_table";
import { SupabaseClient } from "@supabase/supabase-js";

export async function getSuppliersWithProducts(client: SupabaseClient) {
  const { data, error } = await client.from("suppliers").select(`
    id,
    name,
    products (
      id,
      name,
      category,
      subcategory,
      price_ex_vat,
      attachment,
      updated_at
    )
  `);
  if (error) throw error;
  console.log(data);
  return data as (Supplier & { products: Product[] })[];
}
