"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { CalcTier } from "@/lib/calcApi";
import { fmtPct } from "./fields";
import s from "./kalkulator.module.css";

type Row = { min: string; max: string; percent: string };
const toRows = (tiers: CalcTier[]): Row[] =>
  tiers.map((t) => ({ min: String(t.min), max: t.max == null ? "" : String(t.max), percent: String(t.percent).replace(".", ",") }));

/** Varsler om overlapp eller hull (samme regel som motoren). */
export function tierProblems(tiers: CalcTier[]): string[] {
  const problems: string[] = [];
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  sorted.forEach((t, i) => {
    const prev = sorted[i - 1];
    if (!prev) return;
    if (prev.max === null || t.min <= prev.max) problems.push(`${prev.min}–${prev.max ?? "∞"} og ${t.min}–${t.max ?? "∞"} overlapper`);
    else if (t.min > prev.max + 1) problems.push(`${prev.max + 1}–${t.min - 1} paneler mangler trinn`);
  });
  const last = sorted[sorted.length - 1];
  if (last && last.max !== null) problems.push(`ingen regel over ${last.max} paneler`);
  return problems;
}

export function TierEditor({
  tiers,
  editable,
  onSave,
  minStart = 0,
}: {
  tiers: CalcTier[];
  editable: boolean;
  onSave: (tiers: CalcTier[]) => Promise<unknown>;
  minStart?: number;
}) {
  const [rows, setRows] = useState<Row[]>(toRows(tiers));
  const [saving, setSaving] = useState(false);
  useEffect(() => setRows(toRows(tiers)), [tiers]);

  if (!editable) {
    if (!tiers.length) return <div className={s.empty}>Ingen trinn.</div>;
    return (
      <table>
        <thead>
          <tr>
            <th>Paneler</th>
            <th className={s.num}>Sats</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.min}>
              <td className={s.small}>
                {t.min} – {t.max ?? "ubegrenset"}
              </td>
              <td className={s.num}>{fmtPct(t.percent)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const update = (i: number, key: keyof Row, value: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const save = async () => {
    try {
      const parsed: CalcTier[] = rows.map((r) => {
        const min = Number(r.min);
        const max = r.max.trim() === "" ? null : Number(r.max);
        const percent = Number(r.percent.replace(",", "."));
        if (!Number.isInteger(min) || min < minStart) throw new Error(`«Fra» må være et heltall ≥ ${minStart}`);
        if (max !== null && (!Number.isInteger(max) || max < min)) throw new Error("«Til» må være tom eller ≥ «fra»");
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("Sats må være 0–100 %");
        return { min, max, percent };
      });
      setSaving(true);
      await onSave(parsed);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s.panelbody}>
      <p className={`${s.small} ${s.muted}`}>Antall paneler og sats. Tom «til» betyr ubegrenset.</p>
      <table>
        <thead>
          <tr>
            <th>Fra</th>
            <th>Til</th>
            <th>Sats %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><input className={s.input} inputMode="numeric" value={r.min} onChange={(e) => update(i, "min", e.target.value)} aria-label="Fra paneler" /></td>
              <td><input className={s.input} inputMode="numeric" value={r.max} placeholder="∞" onChange={(e) => update(i, "max", e.target.value)} aria-label="Til paneler" /></td>
              <td><input className={s.input} inputMode="decimal" value={r.percent} onChange={(e) => update(i, "percent", e.target.value)} aria-label="Sats" /></td>
              <td className={s.num}>
                <button className={`${s.btn} ${s.ghost} ${s.danger}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Fjern trinn">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={s.rowactions}>
        <button
          className={s.btn}
          onClick={() => {
            const last = rows[rows.length - 1];
            const nextMin = last ? (last.max ? Number(last.max) + 1 : Number(last.min) + 1) : minStart;
            setRows([...rows, { min: String(nextMin), max: "", percent: "0" }]);
          }}
        >
          + Trinn
        </button>
        <button className={`${s.btn} ${s.primary}`} disabled={saving} onClick={save}>
          {saving ? "Lagrer …" : "Lagre trinn"}
        </button>
      </div>
    </div>
  );
}
