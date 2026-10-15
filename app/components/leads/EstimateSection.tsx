"use client";

// Nytt estimat på leaden, med ny kalkulator (soleklart-kalkulator).
// Gammel versjon: docs/backup-gammel-kalkulator/EstimateSection.tsx.bak
//
// Flyt ved «Opprett estimat»:
//   1. kalkyle + låst versjon lagres i kalkulatortjenesten (serveren regner på nytt)
//   2. estimatet opprettes som før, med price_data i dagens format fra versjonen
//   3. estimatet kobles til versjonen (estimates.quote_version_id)
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { ImagePlus } from "lucide-react";
import { SolarData } from "../SolarDataView";
import { supabase } from "@/lib/supabase";
import { createEstimate } from "@/lib/api";
import { CreateEstimateInput, Estimate } from "@/lib/types";
import { PriceOverview } from "@/types/price_table";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import {
  createCalculation,
  getCalcCatalog,
  linkEstimate,
  saveQuoteVersion,
  type CalcCatalog,
  type CalcResult,
} from "@/lib/calcApi";
import Kalkulator from "../kalkulator/Kalkulator";
import type { QuoteDraft } from "../kalkulator/quote";
import s from "../kalkulator/kalkulator.module.css";

interface EstimateSectionProps {
  solarData: SolarData;
  setSolarData: React.Dispatch<React.SetStateAction<SolarData>>;
  onEstimateCreated?: (newEstimate: Estimate) => void;
  ownConsumption: number;
  leadCompany?: string | null;
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

export default function EstimateSection({ solarData, onEstimateCreated, leadCompany }: EstimateSectionProps) {
  const params = useParams();
  const leadId = params.leadId as string;
  const { installerGroupId } = useInstallerGroup();
  const [catalog, setCatalog] = useState<CalcCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!installerGroupId) return;
    getCalcCatalog(installerGroupId)
      .then((c) => {
        setCatalog(c);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [installerGroupId]);

  const uploadImage = async () => {
    if (!imageFile) return null;
    const filePath = `${leadId}/${imageFile.name}-${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from("estimate-images").upload(filePath, imageFile);
    if (uploadError) throw new Error(`Bildeopplasting feilet: ${uploadError.message}`);
    return supabase.storage.from("estimate-images").getPublicUrl(filePath).data.publicUrl;
  };

  const handleCreateEstimate = async (draft: QuoteDraft, result: CalcResult) => {
    if (!installerGroupId) throw new Error("Velg installatør først");

    // 1. Kalkyle og låst versjon (serveren regner på nytt)
    const calculation = await createCalculation({ installerGroupId, leadId, draft });
    const version = await saveQuoteVersion(calculation.id, { lockVersion: calculation.lockVersion, draft }, crypto.randomUUID());

    // 2. Estimatet, med price_data fra versjonen
    const imageUrl = await uploadImage();
    const newEstimate = await createEstimate({
      lead_id: leadId,
      solarData: adjustSolarData(solarData, draft, result),
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
    <div className="flex flex-col gap-4">
      <div className="sk-card flex items-center justify-between gap-3 px-5 py-3">
        <h2 className="sk-section-title">Nytt estimat</h2>
        <label
          htmlFor="finished"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-gray-50"
        >
          <input id="finished" type="checkbox" className="size-4" checked={finished} onChange={(e) => setFinished(e.target.checked)} />
          Ferdigstilt?
        </label>
      </div>

      <div className="sk-card-pad">
        <label htmlFor="estimate-image" className="sk-label flex items-center gap-1.5">
          <ImagePlus size={14} className="text-muted" />
          Bilde til estimatet (valgfritt)
        </label>
        <input
          type="file"
          id="estimate-image"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
          className="block w-full cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-2 text-sm text-muted file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand hover:border-gray-400 hover:file:bg-blue-100"
        />
      </div>

      <div className={s.calc}>
        <div className={s.main}>
          <Kalkulator
            catalog={catalog}
            leadId={leadId}
            initialPanels={solarData.totalPanels}
            initialRoofName={solarData.selectedRoofType}
            onSave={handleCreateEstimate}
            saveLabel="Opprett estimat"
          />
        </div>
      </div>
    </div>
  );
}
