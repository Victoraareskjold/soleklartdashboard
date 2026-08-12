import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type AlertTone = "info" | "success" | "warning" | "danger";

const tones: Record<AlertTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: "var(--status-info-bg)", fg: "var(--status-info-fg)", icon: "info" },
  success: {
    bg: "var(--status-success-bg)",
    fg: "var(--status-success-fg)",
    icon: "check-circle",
  },
  warning: {
    bg: "var(--status-warning-bg)",
    fg: "var(--status-warning-fg)",
    icon: "alert-triangle",
  },
  danger: {
    bg: "var(--status-danger-bg)",
    fg: "var(--status-danger-fg)",
    icon: "alert-circle",
  },
};

export type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  style?: CSSProperties;
};

export function Alert({ tone = "info", title, children, style }: AlertProps) {
  const t = tones[tone];
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        background: t.bg,
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        ...style,
      }}
    >
      <Icon name={t.icon} size={20} style={{ color: t.fg, marginTop: 1 }} />
      <div>
        {title ? (
          <div
            style={{
              fontWeight: "var(--weight-semibold)" as unknown as number,
              color: "var(--text-heading)",
              fontSize: 15,
            }}
          >
            {title}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 14,
            color: "var(--text-body)",
            marginTop: title ? 2 : 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default Alert;
