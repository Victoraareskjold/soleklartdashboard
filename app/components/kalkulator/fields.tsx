"use client";

// Felt som lagrer seg selv når man forlater dem (blur/Enter), som i prototypen.
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { formatOre, oreToInput, parseKroner } from "@/lib/calcApi";
import s from "./kalkulator.module.css";

interface SaveFieldProps<T> {
  value: T;
  editable: boolean;
  onSave: (next: T) => Promise<unknown>;
  label: string;
}

function useSaveField(initial: string, commit: (text: string) => Promise<unknown>) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setText(initial), [initial]);

  const save = async () => {
    if (text.trim() === initial.trim()) return;
    setSaving(true);
    try {
      await commit(text);
    } catch (error) {
      toast.error((error as Error).message);
      setText(initial);
    } finally {
      setSaving(false);
    }
  };
  return { text, setText, saving, save };
}

/** Beløp i øre inn, kroner i feltet. Tomt felt = null (fjernes). */
export function MoneyField({ value, editable, onSave, label, allowEmpty = true }: SaveFieldProps<number | null> & { allowEmpty?: boolean }) {
  const field = useSaveField(oreToInput(value), async (text) => {
    const kroner = parseKroner(text);
    if (kroner === null && !allowEmpty) throw new Error("Beløp må fylles inn");
    await onSave(kroner === null ? null : Math.round(Number(kroner) * 100));
  });
  if (!editable) return <>{value == null ? <span className={`${s.pill} ${s.manual}`}>ikke avtalt</span> : formatOre(value)}</>;
  return (
    <span className={s.inputwrap}>
      <input
        aria-label={label}
        className={`${s.input} ${s.money}`}
        inputMode="decimal"
        value={field.text}
        placeholder="—"
        disabled={field.saving}
        onChange={(e) => field.setText(e.target.value)}
        onBlur={field.save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className={s.suffix}>kr</span>
    </span>
  );
}

/** Prosent. Tomt felt = null (fjernes). */
export function PercentField({ value, editable, onSave, label, max = 100 }: SaveFieldProps<number | null> & { max?: number }) {
  const field = useSaveField(value == null ? "" : String(value).replace(".", ","), async (text) => {
    const cleaned = text.trim().replace(",", ".");
    if (cleaned === "") return onSave(null);
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`Prosent må være mellom 0 og ${max}`);
    await onSave(n);
  });
  if (!editable) return <>{value == null ? <span className={`${s.pill} ${s.manual}`}>mangler</span> : `${fmtPct(value)} %`}</>;
  return (
    <span className={s.inputwrap}>
      <input
        aria-label={label}
        className={`${s.input} ${s.percent}`}
        inputMode="decimal"
        value={field.text}
        placeholder="—"
        disabled={field.saving}
        onChange={(e) => field.setText(e.target.value)}
        onBlur={field.save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className={s.suffix}>%</span>
    </span>
  );
}

export function fmtPct(n: number) {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

/** Kjører en lagring, viser feil som toast og laster data på nytt etterpå. */
export async function saveAndReload(action: () => Promise<unknown>, reload: () => Promise<void>, success?: string) {
  await action();
  if (success) toast.success(success);
  await reload();
}

/** Lite «?»-merke med forklaring ved peker/fokus. */
export function Help({ text }: { text: string }) {
  return (
    <span className={s.help} tabIndex={0} title={text} aria-label={text} role="img">
      ?
    </span>
  );
}

/** Desimaltall med valgfri enhet (f.eks. faktor eller kWp). */
export function NumberField({ value, editable, onSave, label, unit, min = 0, max = 100000 }: SaveFieldProps<number> & { unit?: string; min?: number; max?: number }) {
  const field = useSaveField(String(value).replace(".", ","), async (text) => {
    const n = Number(text.trim().replace(",", "."));
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Verdien må være mellom ${fmtPct(min)} og ${fmtPct(max)}`);
    await onSave(n);
  });
  if (!editable) return <>{fmtPct(value)}{unit ? ` ${unit}` : ""}</>;
  return (
    <span className={s.inputwrap}>
      <input
        aria-label={label}
        className={`${s.input} ${s.percent}`}
        inputMode="decimal"
        value={field.text}
        disabled={field.saving}
        onChange={(e) => field.setText(e.target.value)}
        onBlur={field.save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      {unit && <span className={s.suffix}>{unit}</span>}
    </span>
  );
}
