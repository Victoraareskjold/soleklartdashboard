import { Roof, SolarData } from "@/app/components/SolarDataView";
import { Estimate } from "./types";

interface PVMapPayload {
  name: string;
  email: string;
  phone: string;
  address: string;
  site: string;
  checked: string;
  selectedRoofType: string;
  selectedPanelType: string;
  selectedElPrice: string | number;
  totalPanels: string | number;
  yearlyCost?: string | number;
  yearlyCost2?: string | number;
  yearlyProd?: string | number;
  desiredKwh?: string | number;
  coveragePercentage?: string | number;
  roofs?: Roof[];
}

export function mapPVMapPayloadToSolarData(payload: PVMapPayload): SolarData {
  return {
    totalPanels: Number(payload.totalPanels) || 0,
    selectedPanelType: payload.selectedPanelType,
    selectedRoofType: payload.selectedRoofType,
    selectedElPrice: Number(payload.selectedElPrice) || 0,
    yearlyCost: Number(payload.yearlyCost) || 0,
    yearlyCost2: Number(payload.yearlyCost2) || 0,
    yearlyProd: Number(payload.yearlyProd) || 0,
    desiredKwh: Number(payload.desiredKwh) || 0,
    coveragePercentage: Number(payload.coveragePercentage) || 0,
    imageUrl: "", // hvis du har url fra payloaden
    checkedRoofData: (payload.roofs || []).map(
      (r): Roof => ({
        roofId: r.roofId || "",
        adjustedPanelCount: Number(r.adjustedPanelCount) || 0,
        maxPanels: Number(r.maxPanels) || 0,
        direction: r.direction || "",
        angle: Number(r.angle) || 0,
      })
    ),
  };
}

export function mapEstimateToSolarData(estimate: Estimate): SolarData {
  return {
    imageUrl: estimate.image_url || "",
    totalPanels: Number(estimate.total_panels) || 0,
    selectedPanelType: estimate.selected_panel_type || "",
    selectedRoofType: estimate.selected_roof_type || "",
    selectedElPrice: Number(estimate.selected_el_price) || 0,
    yearlyCost: Number(estimate.yearly_cost) || 0,
    yearlyCost2: Number(estimate.yearly_cost2) || 0,
    yearlyProd: Number(estimate.yearly_prod) || 0,
    desiredKwh: Number(estimate.desired_kwh) || 0,
    coveragePercentage: Number(estimate.coverage_percentage) || 0,
    checkedRoofData: (estimate.checked_roof_data || []).map((r) => ({
      roofId: r.roof_id || "",
      adjustedPanelCount: Number(r.adjusted_panel_count) || 0,
      maxPanels: Number(r.max_panels) || 0,
      direction: r.direction || "",
      angle: Number(r.angle) || 0,
    })),
  };
}

export function mapSolarDataToEstimate(
  data: SolarData,
  leadId: string
): Partial<Estimate> & { lead_id: string } {
  return {
    lead_id: leadId,
    image_url: data.imageUrl,
    total_panels: data.totalPanels,
    selected_panel_type: data.selectedPanelType,
    selected_roof_type: data.selectedRoofType,
    selected_el_price: data.selectedElPrice,
    yearly_cost: data.yearlyCost,
    yearly_cost2: data.yearlyCost2,
    yearly_prod: data.yearlyProd,
    desired_kwh: data.desiredKwh,
    coverage_percentage: data.coveragePercentage,
    checked_roof_data: data.checkedRoofData?.map((r) => ({
      roof_id: r.roofId,
      adjusted_panel_count: r.adjustedPanelCount,
      max_panels: r.maxPanels,
      direction: r.direction,
      angle: r.angle,
    })),
  };
}
