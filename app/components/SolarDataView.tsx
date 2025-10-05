"use client";

export interface SolarData {
  image_url?: string;

  total_panels?: number;
  selected_panel_type?: string;
  selected_roof_type?: string;
  checked_roof_data?: Array<{
    roof_id: string;
    adjusted_panel_count: number;
    max_panels: number;
    direction: string;
    angle: number;
  }>;
  selected_el_price?: number;
  yearly_cost?: number;
  yearly_cost2?: number;
  yearly_prod?: number;
  desired_kwh?: number;
  coverage_percentage?: number;
}

export interface Roof {
  roofId: string;
  adjustedPanelCount: number;
  maxPanels: number;
  direction: string;
  angle: number;
}

interface SolarDataViewProps {
  solarData: SolarData;
  setSolarData: React.Dispatch<React.SetStateAction<SolarData>>;
  readOnly?: boolean;
}

const Input = ({
  label,
  value,
  readOnly,
  field,
  setSolarData,
}: {
  label: string;
  value: string | number | undefined;
  readOnly?: boolean;
  field: keyof SolarData;
  setSolarData: React.Dispatch<React.SetStateAction<SolarData>>;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium mb-1">{label}</label>
      <input
        value={value == 0 ? 0 : value || ""}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) =>
          setSolarData((prev) => ({
            ...prev,
            [field]: e.target.value,
          }))
        }
        placeholder={label}
        className="border p-2 w-full rounded-md bg-white disabled:bg-slate-100"
      />
    </div>
  );
};

export default function SolarDataView({
  solarData,
  setSolarData,
  readOnly = true,
}: SolarDataViewProps) {
  if (!solarData) return null;

  return (
    <div className="mt-4">
      <div className="gap-3 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
        <Input
          label="Årlig produksjon (kWh)"
          value={solarData.yearly_prod}
          readOnly={readOnly}
          field="yearly_prod"
          setSolarData={setSolarData}
        />
        <Input
          label="Strømpris (kr/kWh)"
          value={solarData.selected_el_price}
          readOnly={readOnly}
          field="selected_el_price"
          setSolarData={setSolarData}
        />
        <Input
          label="Taktype"
          value={solarData.selected_roof_type}
          readOnly={readOnly}
          field="selected_roof_type"
          setSolarData={setSolarData}
        />
        <Input
          label="Paneltype"
          value={solarData.selected_panel_type}
          readOnly={readOnly}
          field="selected_panel_type"
          setSolarData={setSolarData}
        />
        <Input
          label="Antall paneler"
          value={solarData.total_panels}
          readOnly={readOnly}
          field="total_panels"
          setSolarData={setSolarData}
        />
        <Input
          label="Desired kWh"
          value={solarData.desired_kwh}
          readOnly={readOnly}
          field="desired_kwh"
          setSolarData={setSolarData}
        />
        <Input
          label="Coverage %"
          value={solarData.coverage_percentage}
          readOnly={readOnly}
          field="coverage_percentage"
          setSolarData={setSolarData}
        />
      </div>

      {solarData.checked_roof_data?.length ? (
        <div className="flex flex-col gap-3 w-full mt-4">
          {solarData.checked_roof_data.map(
            (
              r: {
                roof_id: string;
                adjusted_panel_count: number;
                max_panels: number;
                direction: string;
                angle: number;
              },
              index: number
            ) => {
              const roof: Roof = {
                roofId: r.roof_id,
                adjustedPanelCount: r.adjusted_panel_count,
                maxPanels: r.max_panels,
                direction: r.direction,
                angle: r.angle,
              };
              return (
                <div key={index} className="p-0 mb-2 w-full">
                  <div className="gap-3 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 items-center">
                    <div className="flex flex-col">
                      <label>Tak ID</label>
                      <input
                        className="border p-2 w-full bg-slate-100"
                        value={roof.roofId}
                        readOnly
                      />
                    </div>
                    <div className="flex flex-col">
                      <label>Paneler</label>
                      <input
                        className="border p-2 w-full bg-slate-100"
                        value={roof.adjustedPanelCount}
                        readOnly
                      />
                    </div>
                    <div className="flex flex-col">
                      <label>Maks paneler</label>
                      <input
                        className="border p-2 w-full bg-slate-100"
                        value={roof.maxPanels}
                        readOnly
                      />
                    </div>
                    <div className="flex flex-col">
                      <label>Retning</label>
                      <input
                        className="border p-2 w-full bg-slate-100"
                        value={roof.direction}
                        readOnly
                      />
                    </div>
                    <div className="flex flex-col">
                      <label>Vinkel</label>
                      <input
                        className="border p-2 w-full bg-slate-100"
                        value={roof.angle?.toFixed?.(0) ?? ""}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : null}
    </div>
  );
}
