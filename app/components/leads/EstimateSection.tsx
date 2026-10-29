"use client";

// Nytt estimat på leaden, med ny kalkulator (soleklart-kalkulator).
// Gammel versjon: docs/backup-gammel-kalkulator/EstimateSection.tsx.bak
//
// Flyt ved «Opprett estimat»:
//   1. kalkyle + låst versjon lagres i kalkulatortjenesten (serveren regner på nytt,
//      også batteri/hybrid-tillegget og standardverdiene for økonomi)
//   2. estimatet opprettes som før, med price_data fra versjonen
//      (dagens format + batterySection + economy)
//   3. estimatet kobles til versjonen (estimates.quote_version_id)
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { ImagePlus } from "lucide-react";
import { SolarData } from "../SolarDataView";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/compressImage";
import { createEstimate } from "@/lib/api";
import { CreateEstimateInput, Estimate } from "@/lib/types";
import { PriceOverview } from "@/types/price_table";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import {
  createCalculation,
  getCalcCatalog,
  linkEstimate,
  saveQuoteVersion,
  type BatteryOfferConfig,
  type CalcCatalog,
  type CalcResult,
} from "@/lib/calcApi";
import Kalkulator, { type PreviewExtra } from "../kalkulator/Kalkulator";
import BatteryOfferSetup from "./BatteryOfferSetup";
import Naeringsanalyse from "../kalkulator/Naeringsanalyse";
import EstimateFacilityInfo, { type LeadCustomerInfo } from "./EstimateFacilityInfo";
import type { QuoteDraft } from "../kalkulator/quote";
import s from "../kalkulator/kalkulator.module.css";

interface EstimateSectionProps {
  solarData: SolarData;
  setSolarData: React.Dispatch<React.SetStateAction<SolarData>>;
  onEstimateCreated?: (newEstimate: Estimate) => void;
  ownConsumption: number;
  leadCompany?: string | null;
  /** Kundeinfo fra leaden (person og teknisk), vises ved siden av kalkulatoren */
  customer?: LeadCustomerInfo;
}

/** Watt per panel fra produktnavnet, f.eks. «Astronergy ASTRO N7s 460Wp» → 460. */
const wattFromName = (name?: string) => Number(name?.match(/(\d+)\s*W/i)?.[1] ?? 0);

/** Justerer kWp og årsproduksjon hvis panelantall eller paneltype er endret i kalkulatoren. */
function adjustSolarData(solarData: SolarData, draft: QuoteDraft, result: CalcResult): SolarData {
  const panelLine = draft.lines.find((l) => l.productKind === "panel");
  const panels = result.panelCount;
  const wp = wattFromName(panelLine?.name);
  if (!panels || !wp) return { ...solarData, totalPanels: panels || solarData.totalPanels };

  const newKwp = (panels * wp) / 1000;
  const oldKwp = solarData.kwp ?? ((solarData.totalPanels ?? 0) * wattFromName(solarData.selectedPanelType)) / 1000;
  const yearlyProd = oldKwp > 0 && solarData.yearlyProd ? Math.round((solarData.yearlyProd / oldKwp) * newKwp) : solarData.yearlyProd;
  return { ...solarData, totalPanels: panels, kwp: Number(newKwp.toFixed(2)), yearlyProd, selectedPanelType: panelLine?.name ?? solarData.selectedPanelType };
}

/** Kalkylens sum kan brukes som solcelleinvestering bare når den ikke inneholder batteri. */
function businessInvestment(latest: { draft: QuoteDraft; result: CalcResult } | null): { ore: number | null } {
  if (!latest) return { ore: null };
  if (latest.draft.lines.some((l) => l.productKind === "batteri")) return { ore: null };
  return { ore: latest.result.totals.totalExVat };
}

export default function EstimateSection({ solarData, onEstimateCreated, leadCompany, ownConsumption, customer }: EstimateSectionProps) {
  const params = useParams();
  const leadId = params.leadId as string;
  const { installerGroupId } = useInstallerGroup();
  const [catalog, setCatalog] = useState<CalcCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [finished, setFinished] = useState(false);
  /** Batteri/hybrid-valg for tilbudet. Regnes i tjenesten sammen med kalkylen. */
  const [batteryConfig, setBatteryConfig] = useState<BatteryOfferConfig>({ enabled: true });
  /** Siste kalkyle, for «Kunde og anlegg» og batterioppsettet */
  const [latest, setLatest] = useState<{ draft: QuoteDraft; result: CalcResult; extra: PreviewExtra } | null>(null);
  /** Manuell årsproduksjon (kWh), null = følg kalkylen */
  const [prodOverride, setProdOverride] = useState<number | null>(null);
  /** Næring: analysen som regnes og låses sammen med estimatet */
  const [businessAnalysisId, setBusinessAnalysisId] = useState<string | null>(null);

  const adjusted = latest ? adjustSolarData(solarData, latest.draft, latest.result) : solarData;
  const finalSolarData = (s: SolarData): SolarData => (prodOverride != null ? { ...s, yearlyProd: prodOverride } : s);
  const originalKwp = solarData.kwp ?? ((solarData.totalPanels ?? 0) * wattFromName(solarData.selectedPanelType)) / 1000;
  const business = Boolean(leadCompany);

  useEffect(() => {
    if (!installerGroupId) return;
    getCalcCatalog(installerGroupId)
      .then((c) => {
        setCatalog(c);
        setBatteryConfig({ enabled: c.settings.batteryDefaults?.offerEnabled ?? true });
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [installerGroupId]);

  const uploadImage = async () => {
    if (!imageFile) return null;
    const file = await compressImage(imageFile);
    const filePath = `${leadId}/${file.name}-${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from("estimate-images")
      .upload(filePath, file, { contentType: file.type || undefined });
    if (uploadError) throw new Error(`Bildeopplasting feilet: ${uploadError.message}`);
    return supabase.storage.from("estimate-images").getPublicUrl(filePath).data.publicUrl;
  };

  /** draft inneholder batteryOffer (Kalkulator legger det til før lagring) */
  const handleCreateEstimate = async (draft: QuoteDraft, result: CalcResult) => {
    if (!installerGroupId) throw new Error("Velg installatør først");

    // 1. Kalkyle og låst versjon (serveren regner på nytt, også batteri og hybrid).
    //    Næring: næringsanalysen regnes og låses i samme versjon (price_data.businessAnalysis).
    const sent: QuoteDraft & { businessAnalysisId?: string } = business && businessAnalysisId ? { ...draft, businessAnalysisId } : draft;
    const calculation = await createCalculation({ installerGroupId, leadId, draft: sent });
    const version = await saveQuoteVersion(calculation.id, { lockVersion: calculation.lockVersion, draft: sent }, crypto.randomUUID());
    const analysis = (version.priceData as { businessAnalysis?: { status: string; reason?: string } }).businessAnalysis;
    if (analysis?.status === "ikke beregnet") toast.warn(`Næringsanalysen er ikke med i tilbudet: ${analysis.reason}`);

    // 2. Estimatet, med price_data fra versjonen (inkl. batterySection og economy)
    const imageUrl = await uploadImage();
    const newEstimate = await createEstimate({
      lead_id: leadId,
      solarData: finalSolarData(adjustSolarData(solarData, draft, result)),
      price_data: version.priceData as PriceOverview,
      imageUrl,
      finished,
      leadCompany,
    } as CreateEstimateInput);

    // 3. Kobling. Feiler den, er estimatet likevel komplett; bare sporingen mangler.
    await linkEstimate(calculation.id, newEstimate.id, version.quoteVersionId).catch((e: Error) =>
      toast.warn(`Estimatet er opprettet, men ikke koblet til kalkylen: ${e.message}`),
    );

    toast.success("Estimat opprettet!");
    setImageFile(null);
    onEstimateCreated?.(newEstimate);
  };

  if (!installerGroupId) return <div className="sk-card-pad text-sm text-muted">Velg installatør i menyen for å lage estimat.</div>;
  if (error) return <div className="sk-card-pad text-sm text-red-700">Kalkulatoren kunne ikke lastes: {error}</div>;
  if (!catalog) return <div className="sk-card-pad text-sm text-muted">Laster kalkulator …</div>;

  return (
    <div className="flex flex-col gap-3">
      {/* Én kompakt linje i stedet for to kort, så kalkulatoren starter høyere opp */}
      <div className="sk-card grid grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-2.5 md:grid-cols-[1fr_auto_1fr]">
        <h2 className="sk-section-title">Nytt estimat</h2>
        <label htmlFor="estimate-image" className="flex min-w-0 items-center justify-center gap-2 text-sm text-muted">
          <ImagePlus size={14} className="shrink-0" />
          <span className="whitespace-nowrap">Bilde (valgfritt)</span>
          <input
            type="file"
            id="estimate-image"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
            className="max-w-[260px] cursor-pointer text-xs text-muted file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-soft file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-brand hover:file:bg-blue-100"
          />
        </label>
        <label
          htmlFor="finished"
          className="inline-flex cursor-pointer items-center gap-2 justify-self-start rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-gray-50 md:justify-self-end"
        >
          <input id="finished" type="checkbox" className="size-4" checked={finished} onChange={(e) => setFinished(e.target.checked)} />
          Ferdigstilt?
        </label>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
        <EstimateFacilityInfo
          customer={customer}
          solarData={adjusted}
          originalYearlyProd={solarData.yearlyProd}
          originalKwp={originalKwp}
          prodOverride={prodOverride}
          onProdOverride={setProdOverride}
          ownConsumption={ownConsumption}
          support={latest ? latest.result.support.amount / 100 : null}
          business={business}
        />
        <div className={`${s.calc} ${s.embedded} min-w-0`}>
          <Kalkulator
            catalog={catalog}
            leadId={leadId}
            initialPanels={solarData.totalPanels}
            initialRoofName={solarData.selectedRoofType}
            initialGrid={customer?.voltage === 400 ? "400" : "230"}
            initialCustomerType={business ? "business" : "private"}
            batteryOffer={batteryConfig}
            onSave={handleCreateEstimate}
            saveLabel="Opprett estimat"
            fullWidth
            editableTotals
            onResult={(d, r, extra) => {
              if (r) setLatest({ draft: d, result: r, extra });
            }}
          />
        </div>
      </div>

      {business && installerGroupId && (
        <div className={`${s.calc} ${s.embedded}`}>
          <Naeringsanalyse
            leadId={leadId}
            installerGroupId={installerGroupId}
            kwp={latest?.extra.kwp ?? null}
            investmentOre={businessInvestment(latest).ore}
            draft={latest ? { ...latest.draft, batteryOffer: batteryConfig } : null}
            hasBattery={Boolean(latest?.draft.lines.some((l) => l.productKind === "batteri") || (batteryConfig.enabled && latest?.extra.batteryOffer))}
            roofs={solarData.checkedRoofData}
            address={customer?.address}
            onAnalysis={setBusinessAnalysisId}
          />
        </div>
      )}

      <BatteryOfferSetup
        catalog={catalog}
        config={batteryConfig}
        onChange={setBatteryConfig}
        offer={latest?.extra.batteryOffer ?? null}
        business={business}
      />
    </div>
  );
}
