"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

export type SwitchProps = {
  label?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
};

export function Switch({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled,
  style,
}: SwitchProps) {
  const [inner, setInner] = useState(!!defaultChecked);
  const on = checked !== undefined ? checked : inner;

  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setInner(!on);
    onChange?.(!on);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={toggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 15,
        color: "var(--text-body)",
        background: "transparent",
        border: "none",
        padding: 0,
        ...style,
      }}
    >
      <span
        style={{
          width: 44,
          height: 26,
          borderRadius: "var(--radius-pill)",
          padding: 3,
          flex: "none",
          background: on ? "var(--brand-primary)" : "var(--grey-300)",
          transition: "var(--transition-base)",
          display: "inline-flex",
          justifyContent: on ? "flex-end" : "flex-start",
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "var(--white)",
            boxShadow: "var(--shadow-xs)",
          }}
        />
      </span>
      {label}
    </button>
  );
}

export default Switch;
