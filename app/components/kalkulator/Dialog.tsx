"use client";

import { useEffect, useRef, type ReactNode } from "react";
import s from "./kalkulator.module.css";

/** Enkel modal basert på <dialog>, som i prototypen. */
export function Dialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={ref} className={s.dialog} onCancel={onClose}>
      <div className={s.dialoghead}>
        <h2>{title}</h2>
        <button className={`${s.btn} ${s.ghost}`} onClick={onClose} aria-label="Lukk">
          ×
        </button>
      </div>
      <div className={s.dialogbody}>{children}</div>
      {footer && <div className={s.dialogfoot}>{footer}</div>}
    </dialog>
  );
}
