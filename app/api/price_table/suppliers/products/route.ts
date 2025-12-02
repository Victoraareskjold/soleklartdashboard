import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getSuppliersWithProducts } from "@/lib/db/price_tables";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);

    const suppliers = await getSuppliersWithProducts(client);

    const parsePower = (name: string): number | null => {
      // Match for kW (e.g., "10kW", "7.5 kW", "7,5 kW")
      let match = name.match(/(\d+(?:[.,]\d+)?)\s?kW/i);
      if (match) {
        return parseFloat(match[1].replace(",", "."));
      }

      // Match for kVA (e.g., "10kVA", "7.5 kVA", "7,5 kVA")
      match = name.match(/(\d+(?:[.,]\d+)?)\s?kVA/i);
      if (match) {
        return parseFloat(match[1].replace(",", "."));
      }

      // Match for W (e.g., "5000W", "8 000 W", "7.500 W", "7,500 W") → convert to kW
      match = name.match(/(\d+(?:[.,]\d+)?)\s?W/i);
      if (match) {
        return parseFloat(match[1].replace(",", ".")) / 1000;
      }

      return null;
    };

    const parsePanelWatt = (name: string): number | null => {
      // Matcher f.eks.:
      // 420W, 420 W, 420Wp, 420 Wp, 420 WP, 420 wp
      const match = name.match(/(\d+(?:[.,]\d+)?)\s?W[pP]?/i);
      if (match) return parseFloat(match[1].replace(",", "."));
      return null;
    };

    suppliers.forEach((supplier) => {
      supplier.products.sort((a, b) => {
        const aIsInverter = a.category?.name.toLowerCase() === "inverter";
        const bIsInverter = b.category?.name.toLowerCase() === "inverter";

        const aIsPanel = a.category?.name.toLowerCase() === "solcellepanel";
        const bIsPanel = b.category?.name.toLowerCase() === "solcellepanel";

        if (aIsInverter && bIsInverter) {
          const powerA = parsePower(a.name);
          const powerB = parsePower(b.name);

          if (powerA !== null && powerB !== null) {
            if (powerA !== powerB) return powerA - powerB;
          } else if (powerA !== null) {
            return -1;
          } else if (powerB !== null) {
            return 1;
          }
        }

        if (aIsInverter && !bIsInverter) return -1;
        if (!aIsInverter && bIsInverter) return 1;

        if (aIsPanel && bIsPanel) {
          const wattA = parsePanelWatt(a.name);
          const wattB = parsePanelWatt(b.name);

          if (wattA !== null && wattB !== null) {
            if (wattA !== wattB) return wattA - wattB;
          } else if (wattA !== null) {
            return -1;
          } else if (wattB !== null) {
            return 1;
          }
        }

        if (aIsPanel && !bIsPanel) return -1;
        if (!aIsPanel && bIsPanel) return 1;

        // Fallback to existing sort order (from DB) or name
        const aIndex = a.subcategory?.index ?? Infinity;
        const bIndex = b.subcategory?.index ?? Infinity;
        if (aIndex !== bIndex) return aIndex - bIndex;

        return a.name.localeCompare(b.name);
      });
    });

    return NextResponse.json(suppliers);
  } catch (err) {
    console.error("GET /api/price_table error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const body = await req.json();

    const { data, error } = await client
      .from("products")
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("POST /api/price_table/products error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
