"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardTone = "default" | "subtle" | "brand" | "accent" | "inverse";

const pads: Record<CardPadding, string | number> = {
  none: 0,
  sm: "var(--space-4)",
  md: "var(--space-6)",
  lg: "var(--space-8)",
};

const tones: Record<CardTone, CSSProperties> = {
  default: {
    background: "var(--surface-card)",
    border: "1px solid var(--border-subtle)",
  },
  subtle: {
    background: "var(--surface-subtle)",
    border: "1px solid var(--border-subtle)",
  },
  brand: {
    background: "var(--surface-brand-soft)",
    border: "1px solid var(--blue-100)",
  },
  accent: {
    background: "var(--surface-accent-soft)",
    border: "1px solid var(--orange-100)",
  },
  inverse: {
    background: "var(--surface-inverse)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "var(--blue-300)",
  },
};

export type CardProps = {
  children?: ReactNode;
  padding?: CardPadding;
  tone?: CardTone;
  hoverable?: boolean;
  style?: CSSProperties;
  className?: string;
};

export function Card({
  children,
  padding = "lg",
  tone = "default",
  hoverable,
  style,
  className,
}: CardProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: "var(--radius-lg)",
        padding: pads[padding],
        boxShadow: "var(--shadow-sm)",
        transition: "var(--transition-base)",
        ...tones[tone],
        ...(hoverable && hover
          ? { boxShadow: "var(--shadow-md)", transform: "translateY(-2px)" }
          : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;
