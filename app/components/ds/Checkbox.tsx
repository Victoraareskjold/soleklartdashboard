"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

export type CheckboxProps = {
  label?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  style?: CSSProperties;
};

export function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled,
  name,
  style,
}: CheckboxProps) {
  const [inner, setInner] = useState(!!defaultChecked);
  const on = checked !== undefined ? checked : inner;

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 15,
        color: "var(--text-body)",
        ...style,
      }}
    >
      <input
        type="checkbox"
        name={name}
        checked={on}
        disabled={disabled}
        onChange={(e) => {
          if (checked === undefined) setInner(e.target.checked);
          onChange?.(e.target.checked);
        }}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          width: 20,
          height: 20,
          flex: "none",
          borderRadius: "var(--radius-xs)",
          border: `1px solid ${on ? "var(--brand-primary)" : "var(--border-strong)"}`,
          background: on ? "var(--brand-primary)" : "var(--white)",
          color: "var(--white)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "var(--transition-base)",
        }}
      >
        {on ? <Icon name="check" size={14} /> : null}
      </span>
      {label}
    </label>
  );
}

export default Checkbox;
