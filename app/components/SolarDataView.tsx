"use client";

export interface Roof {
  roofId: string;
  adjustedPanelCount: number;
  maxPanels: number;
  direction: string;
  angle: number;
}

export interface SolarData {
  imageUrl?: string;
  totalPanels?: number;
  selectedPanelType?: string;
  selectedRoofType?: string;
  checkedRoofData?: Roof[];
  selectedElPrice?: number;
  yearlyCost?: number;
  yearlyCost2?: number;
  yearlyProd?: number;
  desiredKwh?: number;
  coveragePercentage?: number;
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

  console.log(solarData);

  return (
    <div className="mt-4">
      <div className="gap-3 grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
        <Input
          label="Årlig produksjon (kWh)"
          value={solarData.yearlyProd}
          readOnly={readOnly}
          field="yearlyProd"
          setSolarData={setSolarData}
        />
        <Input
          label="Strømpris (kr/kWh)"
          value={solarData.selectedElPrice}
          readOnly={readOnly}
          field="selectedElPrice"
          setSolarData={setSolarData}
        />
        <Input
          label="Taktype"
          value={solarData.selectedRoofType}
          readOnly={readOnly}
          field="selectedRoofType"
          setSolarData={setSolarData}
        />
        <Input
          label="Paneltype"
          value={solarData.selectedPanelType}
          readOnly={readOnly}
          field="selectedPanelType"
          setSolarData={setSolarData}
        />
        <Input
          label="Antall paneler"
          value={solarData.totalPanels}
          readOnly={readOnly}
          field="totalPanels"
          setSolarData={setSolarData}
        />
        <Input
          label="Desired kWh"
          value={solarData.desiredKwh}
          readOnly={readOnly}
          field="desiredKwh"
          setSolarData={setSolarData}
        />
        <Input
          label="Coverage %"
          value={solarData.coveragePercentage}
          readOnly={readOnly}
          field="coveragePercentage"
          setSolarData={setSolarData}
        />
      </div>

      {solarData.checkedRoofData?.length ? (
        <div className="flex flex-col gap-3 w-full mt-4">
          {solarData.checkedRoofData?.map((roof, index) => {
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
          })}
        </div>
      ) : null}
    </div>
  );
}
