"use client";

// Ny priskalkulator: prisberegning, felles produktkatalog og prisavtaler per installatør.
// Brukes på /dashboard/pricetable.
import { useCallback, useEffect, useState } from "react";
import { getCalcCatalog, type CalcCatalog } from "@/lib/calcApi";
import { Agreements } from "./Agreements";
import { Catalog } from "./Catalog";
import Kalkulator from "./Kalkulator";
import { Rules } from "./Rules";
import s from "./kalkulator.module.css";

type Tab = "calculator" | "catalog" | "agreements" | "rules";

/** installerGroupId kommer fra dashboardet (installatørvelgeren i menyen, eller leaden). */
export default function Prisoppsett({ installerGroupId }: { installerGroupId: string | null }) {
  const [tab, setTab] = useState<Tab>("calculator");
  const [catalog, setCatalog] = useState<CalcCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!installerGroupId) return;
    try {
      setCatalog(await getCalcCatalog(installerGroupId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [installerGroupId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loading = !catalog || catalog.installer.id !== installerGroupId;

  return (
    <div className={s.calc}>
      <nav className={s.nav}>
        {(
          [
            ["calculator", "Prisberegning"],
            ["catalog", "Produktkatalog"],
            ["agreements", "Prisavtaler"],
            ["rules", "Beregningsregler"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? s.active : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div className={s.main}>
        {!installerGroupId && <div className={`${s.notice} ${s.info}`}>Velg installatør i menyen for å se priser og regne.</div>}
        {error && <div className={`${s.notice} ${s.error}`}>{error}</div>}

        {/* Kalkulatoren holdes montert så utkastet ikke forsvinner når man bytter fane */}
        {tab === "calculator" && loading && installerGroupId && <div className={s.empty}>Laster …</div>}
        {catalog && (
          <div hidden={tab !== "calculator" || loading}>
            <Kalkulator catalog={catalog} />
          </div>
        )}

        {tab !== "calculator" && loading && installerGroupId && <div className={s.empty}>Laster …</div>}
        {!loading && tab === "agreements" && <Agreements catalog={catalog} reload={reload} />}
        {!loading && tab === "catalog" && <Catalog catalog={catalog} reload={reload} />}
        {!loading && tab === "rules" && <Rules catalog={catalog} reload={reload} />}
      </div>
    </div>
  );
}
