"use client";

import { ColdCallLead, FormData } from "@/app/dashboard/coldCalling/page";
import { LeadStatus } from "@/constants/leadStatuses";
import { RoofType } from "@/lib/types";

type InputField = {
  key: string;
  type: "text" | "select" | "number" | "textarea";
  placeholder: string;
  label: string;
  options?: { value: string | number; label: string }[];
};

type RenderInputFieldsProps = {
  lead: ColdCallLead;
  index: number;
  formData: FormData;
  onFormDataChange: (leadId: string, fieldKey: string, value: string) => void;
  roofTypeOptions: RoofType[];
};

const INPUT_FIELDS: InputField[] = [
  {
    key: "email",
    type: "text",
    placeholder: "E-post",
    label: "E-post",
  },
  {
    key: "roof_type_id",
    type: "select",
    placeholder: "Taktekke",
    label: "Taktekke",
  },
  {
    key: "own_consumption",
    type: "number",
    placeholder: "Eget forbruk (kWh)",
    label: "Eget forbruk",
  },
  {
    key: "voltage",
    type: "select",
    placeholder: "Nettspenning",
    label: "Nettspenning",
    options: [
      { value: 230, label: "230V" },
      { value: 400, label: "400V" },
    ],
  },
  {
    key: "roof_slope",
    type: "number",
    placeholder: "Helning på tak",
    label: "Helning på tak",
  },
  {
    key: "roof_age",
    type: "number",
    placeholder: "Alder på tak",
    label: "Alder på tak",
  },
  {
    key: "note",
    type: "textarea",
    placeholder: "Merknad",
    label: "Merknad",
  },
];

export default function RenderInputFields({
  lead,
  formData,
  onFormDataChange,
  roofTypeOptions,
}: RenderInputFieldsProps) {
  const currentStatus = String(formData[lead.id]?.status ?? "");

  const renderField = (field: InputField) => {
    const value =
      (formData[lead.id] as Record<string, string>)?.[field.key] || "";

    if (field.type === "select") {
      const options =
        field.key === "roof_type_id"
          ? roofTypeOptions.map((t) => ({ value: t.id, label: t.name }))
          : field.options || [];
      return (
        <select
          className="sk-input h-8 cursor-pointer text-[13px]"
          value={value}
          onChange={(e) => onFormDataChange(lead.id, field.key, e.target.value)}
        >
          <option value="">Velg {field.label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          className="sk-textarea block h-8 min-h-8 resize-y py-1.5 text-[13px] leading-[1.15rem]"
          rows={1}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onFormDataChange(lead.id, field.key, e.target.value)}
        />
      );
    }

    return (
      <input
        type={field.type || "text"}
        placeholder={field.placeholder}
        className={`sk-input h-8 text-[13px] ${
          field.type === "number" ? "tabular-nums" : ""
        }`}
        value={value}
        onChange={(e) => onFormDataChange(lead.id, field.key, e.target.value)}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
        {INPUT_FIELDS.map((field) => (
          <div
            key={field.key}
            className={
              field.type === "textarea" || field.key === "email"
                ? "col-span-2"
                : ""
            }
          >
            <label className="mb-1 block text-[11px] font-semibold text-muted">
              {field.label}
            </label>
            {renderField(field)}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="sk-eyebrow mr-1">Status</span>
        {LeadStatus.map((stat) => {
          const isActive = currentStatus === String(stat.value);
          return (
            <button
              key={stat.value}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                onFormDataChange(
                  lead.id,
                  "status",
                  isActive ? "" : String(stat.value),
                )
              }
              className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-all ${
                isActive
                  ? "text-ink shadow-[0_1px_2px_rgba(11,27,51,0.08)]"
                  : "border-line bg-surface text-body hover:border-gray-300 hover:bg-gray-50 hover:text-ink"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: `${stat.color}26`,
                      borderColor: stat.color,
                      boxShadow: `0 0 0 1px ${stat.color}`,
                    }
                  : undefined
              }
            >
              <span
                className="size-2 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: stat.color }}
              />
              {stat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
