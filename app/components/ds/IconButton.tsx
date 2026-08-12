"use client";

import { useState, type CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

export type IconButtonVariant = "outline" | "ghost" | "solid";

const variants: Record<IconButtonVariant, CSSProperties> = {
  outline: {
    background: "var(--white)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-heading)",
  },
  ghost: {
    background: "transparent",
    border: "1px solid transparent",
    color: "var(--text-body)",
  },
  solid: {
    background: "var(--brand-primary)",
    border: "1px solid transparent",
    color: "var(--white)",
  },
};

const hovers: Record<IconButtonVariant, CSSProperties> = {
  outline: { background: "var(--grey-50)" },
  ghost: { background: "var(--grey-100)" },
  solid: { background: "var(--brand-primary-hover)" },
};

export type IconButtonProps = {
  icon: IconName;
  label: string;
  size?: "sm" | "md";
  variant?: IconButtonVariant;
  onClick?: () => void;
  style?: CSSProperties;
};

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "outline",
  onClick,
  style,
}: IconButtonProps) {
  const [hover, setHover] = useState(false);
  const box = size === "sm" ? 36 : 44;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: box,
        height: box,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        transition: "var(--transition-base)",
        ...variants[variant],
        ...(hover ? hovers[variant] : null),
        ...style,
      }}
    >
      <Icon name={icon} size={size === "sm" ? 17 : 20} />
    </button>
  );
}

export default IconButton;
