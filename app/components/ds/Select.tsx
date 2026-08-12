"use client";

import { useState, type CSSProperties } from "react";
import { Icon } from "./Icon";

export type SelectOption = string | { value: string; label: string };

export type SelectProps = {
  label?: string;
  hint?: string;
  options?: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  style?: CSSProperties;
};

export function Select({
  label,
  hint,
  options = [],
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  style,
}: SelectProps) {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: "block", ...style }}>
      {label ? (
        <span
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: 14,
            fontWeight: "var(--weight-semibold)" as unknown as number,
            color: "var(--text-heading)",
          }}
        >
          {label}
        </span>
      ) : null}
      <span style={{ position: "relative", display: "block" }}>
        <select
          name={name}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: "100%",
            height: 46,
            appearance: "none",
            fontFamily: "var(--font-body)",
            fontSize: 15,
            color: "var(--text-heading)",
            background: "var(--white)",
            border: `1px solid ${focus ? "var(--border-brand)" : "var(--border-subtle)"}`,
            borderRadius: "var(--radius-sm)",
            padding: "0 40px 0 14px",
            outline: "none",
            boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
            transition: "var(--transition-base)",
          }}
        >
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            const l = typeof o === "string" ? o : o.label;
            return (
              <option key={v} value={v}>
                {l}
              </option>
            );
          })}
        </select>
        <Icon
          name="chevron-down"
          size={18}
          style={{
            position: "absolute",
            right: 14,
            top: 14,
            color: "var(--grey-500)",
            pointerEvents: "none",
          }}
        />
      </span>
      {hint ? (
        <span
          style={{
            display: "block",
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export default Select;
