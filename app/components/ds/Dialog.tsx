"use client";

import { useEffect, type ReactNode } from "react";
import { IconButton } from "./IconButton";

export type DialogProps = {
  open?: boolean;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  width?: number;
};

export function Dialog({
  open = true,
  title,
  description,
  children,
  footer,
  onClose,
  width = 480,
}: DialogProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 27, 51, 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--surface-card)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: "var(--space-8)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            {title ? <h3 style={{ fontSize: 22, margin: 0 }}>{title}</h3> : null}
            {description ? (
              <p
                style={{
                  marginTop: 6,
                  color: "var(--text-body)",
                  fontSize: 15,
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          {onClose ? (
            <IconButton
              icon="x"
              label="Lukk"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          ) : null}
        </div>
        {children ? (
          <div style={{ marginTop: "var(--space-6)" }}>{children}</div>
        ) : null}
        {footer ? (
          <div
            style={{
              marginTop: "var(--space-8)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-3)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Dialog;
