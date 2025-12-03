"use client";

import { ColdCallLead, FormData } from "@/app/(dashboard)/coldCalling/page";

type InputField = {
  key: string;
  type: "text" | "select";
  placeholder: string;
  label: string;
  inputType?: string;
  options?: { value: string; label: string }[];
};

type RenderInputFieldsProps = {
  lead: ColdCallLead;
  formData: FormData;
  onFormDataChange: (leadId: string, fieldKey: string, value: string) => void;
};

const INPUT_FIELDS: InputField[] = [
  {
    key: "email",
    type: "text",
    placeholder: "E-post",
    label: "E-post",
  },
  {
    key: "roof_type",
    type: "select",
    placeholder: "Taktype",
    label: "Taktype",
    options: [
      { value: "", label: "Velg taktype" },
      { value: "flat", label: "Flatt tak" },
      { value: "pitched", label: "Skråtak" },
      { value: "other", label: "Annet" },
    ],
  },
  {
    key: "own_consumption",
    type: "text",
    placeholder: "Eget forbruk (kWh)",
    label: "Eget forbruk",
    inputType: "number",
  },
  {
    key: "grid_voltage",
    type: "select",
    placeholder: "Nettspenning",
    label: "Nettspenning",
    options: [
      { value: "", label: "Velg nettspenning" },
      { value: "230v", label: "230V" },
      { value: "400v", label: "400V" },
    ],
  },
  {
    key: "roof_area",
    type: "text",
    placeholder: "Takflate (m²)",
    label: "Takflate",
    inputType: "number",
  },
  {
    key: "notes",
    type: "text",
    placeholder: "Notater",
    label: "Notater",
  },
];

export default function RenderInputFields({
  lead,
  formData,
  onFormDataChange,
}: RenderInputFieldsProps) {
  const renderField = (field: InputField) => {
    const value =
      (formData[lead.id] as Record<string, string>)?.[field.key] || "";

    if (field.type === "select" && field.options) {
      return (
        <select
          className="w-full"
          value={value}
          onChange={(e) => onFormDataChange(lead.id, field.key, e.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.inputType || "text"}
        placeholder={field.placeholder}
        className="w-full"
        value={value}
        onChange={(e) => onFormDataChange(lead.id, field.key, e.target.value)}
      />
    );
  };

  return (
    <div className="grid grid-cols-7">
      {INPUT_FIELDS.map((field) => (
        <div key={field.key} className="border p-1">
          {renderField(field)}
        </div>
      ))}
      <div className="border p-1">
        <select
          className="w-full"
          value={formData[lead.id]?.status || ""}
          onChange={(e) => onFormDataChange(lead.id, "status", e.target.value)}
        >
          <option value="">Status</option>
          <option value="new">Ny</option>
          <option value="contacted">Kontaktet</option>
          <option value="not_interested">Ikke interessert</option>
        </select>
      </div>
    </div>
  );
}
