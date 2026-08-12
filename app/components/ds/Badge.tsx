import type { CSSProperties, ReactNode } from "react";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, CSSProperties> = {
  neutral: { background: "var(--grey-100)", color: "var(--grey-700)" },
  brand: { background: "var(--blue-100)", color: "var(--blue-700)" },
  success: {
    background: "var(--status-success-bg)",
    color: "var(--status-success-fg)",
  },
  warning: {
    background: "var(--status-warning-bg)",
    color: "var(--status-warning-fg)",
  },
  danger: {
    background: "var(--status-danger-bg)",
    color: "var(--status-danger-fg)",
  },
};

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  style?: CSSProperties;
};

export function Badge({ children, tone = "neutral", dot, style }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--text-caption-size)",
        fontWeight: "var(--weight-semibold)" as unknown as number,
        letterSpacing: "0.01em",
        ...tones[tone],
        ...style,
      }}
    >
      {dot ? (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
          }}
        />
      ) : null}
      {children}
    </span>
  );
}

export default Badge;
