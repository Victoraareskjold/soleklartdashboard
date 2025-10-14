"use client";

import React, { useState } from "react";
import { supplierCategoryConfig } from "@/lib/config/supplierCategories";
import { SupplierRow } from "@/types/price";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getToken } from "@/lib/api";

type Props = {
  category: keyof typeof supplierCategoryConfig;
  data: Record<string, SupplierRow[]>;
  onChange: (key: string, rows: SupplierRow[]) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string, idx: number) => void;
};

export function SupplierCategoryTable({
  category,
  data,
  onChange,
  onAdd,
  onRemove,
}: Props) {
  const config = supplierCategoryConfig[category];
  const [uploading, setUploading] = useState(false);
  if (!config) return null;

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    sectionKey: string,
    idx: number
  ) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf") {
        alert("Kun PDF-filer er tillatt.");
        return;
      }

      setUploading(true);

      const token = await getToken();
      const supabase = createSupabaseClient(token);

      // Unik filsti
      const filePath = `attachments/${Date.now()}_${file.name}`;

      const { error } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);

      const rows = data[sectionKey] ?? [];
      const updated = [...rows];
      updated[idx] = {
        ...updated[idx],
        attachment: publicUrlData.publicUrl,
      };
      onChange(sectionKey, updated);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Kunne ikke laste opp PDF-filen.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border rounded-md mb-8 overflow-hidden">
      <h2 className="text-xl font-semibold bg-gray-200 p-2">{config.label}</h2>

      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border-t p-2 w-1/3">Vedlegg</th>
            <th className="border p-2 w-1/3">Beskrivelse</th>
            <th className="border p-2 w-1/3">Pris (NOK eks. mva)</th>
            <th className="border px-5"></th>
          </tr>
        </thead>

        <tbody>
          {config.sections.map((section) => {
            const rows = data[section.key] ?? [];

            return (
              <React.Fragment key={section.key}>
                <tr>
                  <td
                    colSpan={4}
                    className="font-bold bg-gray-100 p-2 border-t text-left"
                  >
                    {section.title}
                  </td>
                </tr>

                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="border p-2">
                      {row.attachment ? (
                        <div className="flex items-center justify-between">
                          <a
                            href={row.attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline truncate max-w-[200px]"
                          >
                            PDF
                          </a>
                          {/* <button
                            onClick={() => {
                              const updated = [...rows];
                              updated[idx] = {
                                ...updated[idx],
                                attachment: "",
                              };
                              onChange(section.key, updated);
                            }}
                            className="text-red-500 text-sm ml-2"
                          >
                            Fjern
                          </button> */}
                        </div>
                      ) : (
                        <label className="cursor-pointer text-blue-600 underline">
                          {uploading ? "Laster opp..." : "Last opp PDF"}
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => handleUpload(e, section.key, idx)}
                          />
                        </label>
                      )}
                    </td>

                    <td className="border p-2">
                      <input
                        value={row.description}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx] = {
                            ...updated[idx],
                            description: e.target.value,
                          };
                          onChange(section.key, updated);
                        }}
                        className="w-full"
                      />
                    </td>

                    <td className="border p-2">
                      <input
                        type="number"
                        value={row.priceExVat}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx] = {
                            ...updated[idx],
                            priceExVat: Number(e.target.value),
                          };
                          onChange(section.key, updated);
                        }}
                        className="w-full"
                      />
                    </td>

                    <td className="border p-2 text-center">
                      <button onClick={() => onRemove(section.key, idx)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={4} className="p-2 text-right border-t">
                    <button
                      onClick={() => onAdd(section.key)}
                      className="bg-gray-200 px-3 py-1 rounded"
                    >
                      + Legg til rad
                    </button>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
