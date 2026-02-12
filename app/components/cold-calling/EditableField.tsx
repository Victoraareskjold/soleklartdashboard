import { ColdCallLead } from "@/app/(dashboard)/coldCalling/page";
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
    <td className={`border p-1 w-1/6 relative ${className}`}>
      {isEditing ? (
        <input
          type={inputType}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full h-full p-0 m-0 border-none bg-transparent focus:outline-none"
        />
      ) : (
        <div className="flex items-center justify-between group">
          <span onDoubleClick={handleDoubleClick}>{localValue || "N/A"}</span>
          <button
            onClick={() => setIsEditing(true)}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
            title={`Edit ${String(fieldKey)}`}
          >
            <Pencil size={14} className="text-gray-600" />
          </button>
          {isAddressField && handleCopyAddress && localValue && (
            <button
              onClick={() => handleCopyAddress(localValue)}
              className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy address"
            >
              <Copy size={14} />
            </button>
          )}
        </div>
      )}
    </td>
  );
};

export default EditableField;
