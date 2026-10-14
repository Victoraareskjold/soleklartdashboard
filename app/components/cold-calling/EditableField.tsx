import { ColdCallLead } from "@/app/dashboard/coldCalling/page";
import { Copy, Pencil } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";

type EditableFieldProps = {
  leadId: string;
  fieldKey: keyof ColdCallLead;
  initialValue: string | number | null;
  onFormDataChange: (leadId: string, fieldKey: string, value: string) => void;
  onSave: (
    leadId: string,
    fieldKey: keyof ColdCallLead,
    value: string,
  ) => Promise<void>;
  inputType?: "text" | "number" | "email" | "tel";
  className?: string;
  isAddressField?: boolean; // Special prop for address field to handle Copy icon
  handleCopyAddress?: (addr: string | null) => void; // Function to copy address
};

const EditableField: React.FC<EditableFieldProps> = ({
  leadId,
  fieldKey,
  initialValue,
  onFormDataChange,
  onSave,
  inputType = "text",
  className = "",
  isAddressField = false,
  handleCopyAddress,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(
    initialValue !== null ? String(initialValue) : "",
  );

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = async () => {
    setIsEditing(false);
    if (localValue !== (initialValue !== null ? String(initialValue) : "")) {
      onFormDataChange(leadId, fieldKey, localValue);
      await onSave(leadId, fieldKey, localValue);
      toast.success(`${fieldKey} updated!`);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setLocalValue(e.target.value);
  };

  const handleKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      if (localValue !== (initialValue !== null ? String(initialValue) : "")) {
        onFormDataChange(leadId, fieldKey, localValue);
        await onSave(leadId, fieldKey, localValue);
        toast.success(`${fieldKey} updated!`);
      }
    }
  };

  return (
    <td
      className={`group relative w-1/6 border-b border-gray-100 px-3 py-2 text-sm text-gray-700 ${className}`}
    >
      {isEditing ? (
        <input
          type={inputType}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="sk-input h-8"
        />
      ) : (
        <div className="flex min-h-8 items-center justify-between gap-2">
          {isAddressField && handleCopyAddress && localValue && (
            <button
              onClick={() => handleCopyAddress(localValue)}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-gray-100 hover:text-ink group-hover:opacity-100"
              title="Copy address"
            >
              <Copy size={13} />
            </button>
          )}
          <span
            onDoubleClick={handleDoubleClick}
            className={`flex-1 truncate ${localValue ? "text-ink" : "text-gray-400"}`}
          >
            {localValue || "N/A"}
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-gray-100 hover:text-ink group-hover:opacity-100"
            title={`Edit ${String(fieldKey)}`}
          >
            <Pencil size={13} />
          </button>
        </div>
      )}
    </td>
  );
};

export default EditableField;
