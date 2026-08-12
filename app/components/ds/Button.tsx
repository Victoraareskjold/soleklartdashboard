"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "var(--font-body)",
  fontWeight: "var(--weight-semibold)" as unknown as number,
  borderRadius: "var(--radius-sm)",
  border: "1px solid transparent",
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "var(--transition-base)",
};

const sizes: Record<ButtonSize, CSSProperties> = {
  sm: { height: 36, padding: "0 14px", fontSize: 14 },
  md: { height: 44, padding: "0 20px", fontSize: 15 },
  lg: { height: 54, padding: "0 28px", fontSize: 17 },
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "var(--brand-primary)",
    color: "var(--text-on-brand)",
    boxShadow: "var(--shadow-brand)",
  },
  secondary: { background: "var(--brand-secondary)", color: "var(--blue-900)" },
  outline: {
    background: "var(--white)",
    color: "var(--text-heading)",
    borderColor: "var(--border-strong)",
    boxShadow: "var(--shadow-xs)",
  },
  ghost: { background: "transparent", color: "var(--text-heading)" },
  inverse: { background: "var(--white)", color: "var(--blue-700)" },
};

const hovers: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--brand-primary-hover)" },
  secondary: { background: "var(--brand-secondary-hover)" },
  outline: { background: "var(--grey-50)", borderColor: "var(--grey-400)" },
  ghost: { background: "var(--grey-100)" },
  inverse: { background: "var(--blue-50)" },
};

export type ButtonProps = {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  disabled?: boolean;
  /** Intern rute (bruker next/link) eller ekstern/mailto/tel-lenke (bruker <a>). */
  href?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  style?: CSSProperties;
  "aria-label"?: string;
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "right",
  fullWidth,
  disabled,
  href,
  target,
  rel,
  type = "button",
  onClick,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const composed: CSSProperties = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...(hover && !disabled ? hovers[variant] : null),
    ...(press && !disabled ? { transform: "translateY(1px)" } : null),
    ...(fullWidth ? { width: "100%" } : null),
    ...(disabled
      ? { opacity: 0.45, cursor: "not-allowed", boxShadow: "none" }
      : null),
    ...style,
  };

  const glyph = icon ? <Icon name={icon} size={size === "lg" ? 20 : 17} /> : null;
  const body = (
    <>
      {glyph && iconPosition === "left" ? glyph : null}
      {children}
      {glyph && iconPosition === "right" ? glyph : null}
    </>
  );

  const interaction = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
  };

  if (href) {
    const isInternal = href.startsWith("/") && !href.startsWith("//");
    if (isInternal) {
      return (
        <Link href={href} style={composed} onClick={onClick} {...interaction} {...rest}>
          {body}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
        style={composed}
        onClick={onClick}
        {...interaction}
        {...rest}
      >
        {body}
      </a>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={composed}
      {...interaction}
      {...rest}
    >
      {body}
    </button>
  );
}

export default Button;
