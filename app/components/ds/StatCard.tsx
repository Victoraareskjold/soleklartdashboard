import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

export type StatCardProps = {
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "success" | "danger" | "neutral";
  icon?: IconName;
  style?: CSSProperties;
};

const tones = {
  success: "var(--status-success-fg)",
  danger: "var(--status-danger-fg)",
  neutral: "var(--text-muted)",
};

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "success",
  icon,
  style,
}: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-6)",
        boxShadow: "var(--shadow-sm)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--text-muted)",
          fontSize: 14,
          fontWeight: "var(--weight-medium)" as unknown as number,
        }}
      >
        {icon ? <Icon name={icon} size={16} /> : null}
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-display)",
          fontSize: 34,
          lineHeight: 1.1,
          fontWeight: "var(--weight-semibold)" as unknown as number,
          color: "var(--text-heading)",
          letterSpacing: "var(--tracking-heading)",
        }}
      >
        {value}
      </div>
      {delta ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: "var(--weight-semibold)" as unknown as number,
            color: tones[deltaTone],
          }}
        >
          {delta}
        </div>
      ) : null}
    </div>
  );
}

export default StatCard;
