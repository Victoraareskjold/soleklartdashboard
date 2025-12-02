import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

type ExcelRow = {
  Gatenavn?: string;
  Husnummer?: string;
  Bokstav?: string;
  Poststed?: string;
  Fornavn?: string;
  Etternavn?: string;
  Rolle?: string;
  Firmanavn?: string;
  Mobil?: string;
  Telefon?: string;
};

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  const parsed = rows.map((row) => {
    const addressParts = [
      row["Gatenavn"],
      row["Husnummer"],
      row["Bokstav"],
    ].filter(Boolean);
    const address =
      addressParts.join(" ") + (row["Poststed"] ? ", " + row["Poststed"] : "");

    const nameParts = [row["Fornavn"], row["Etternavn"]].filter(Boolean);
    const name = nameParts.join(" ");

    return {
      address: address || "Ingen addresse",
      name: name || "Ingen navn",
      role: row["Rolle"] || "Ingen rolle",
      company: row["Firmanavn"] || "Ingen firma",
      mobile: row["Mobil"] || "Ingen mobil",
      phone: row["Telefon"] || "Ingen telefon",
    };
  });

  return NextResponse.json({ leads: parsed });
}
