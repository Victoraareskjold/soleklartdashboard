"use client";

import { ColdCallLead, FormData } from "@/app/(dashboard)/coldCalling/page";
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
  const selectedStatus = LeadStatus.find(
    (s) => String(s.value) === String(formData[lead.id]?.status)
  );

  const textColor =
    selectedStatus?.value == null || selectedStatus?.value === 1
      ? "#000"
      : "#fff";

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
          className="w-full p-1 h-7"
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
      return <textarea className="w-full min-h-7! h-7 p-1" />;
    }

    return (
      <input
        type={field.type || "text"}
        placeholder={field.placeholder}
        className="w-full p-1"
        value={value}
        onChange={(e) => onFormDataChange(lead.id, field.key, e.target.value)}
      />
    );
  };

  return (
    <div className="grid grid-cols-9 text-sm items-center">
      {INPUT_FIELDS.map((field) => (
        <div key={field.key} className="border">
          {renderField(field)}
        </div>
      ))}
      <div className="border text-sm">
        <select
          className="w-full h-7 p-1"
          value={formData[lead.id]?.status || ""}
          onChange={(e) => onFormDataChange(lead.id, "status", e.target.value)}
          style={{
            backgroundColor: selectedStatus?.color || "white",
            color: textColor,
          }}
        >
          <option value="">Status</option>
          {LeadStatus.map((stat) => (
            <option key={stat.value} value={stat.value}>
              {stat.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
