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
  kwp?: number;
  autoKwp?: number;
  manualKwp?: number;
  kwpMode?: "auto" | "manual";
  voltage?: number;
  defaultPanelSupplierId?: string;
  defaultPanelProductId?: string;
  defaultFesteSupplierId?: string;
  defaultInverterSupplierId?: string;
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
  type,
}: {
  label: string;
  value: string | number | undefined;
  readOnly?: boolean;
  field: keyof SolarData;
  setSolarData: React.Dispatch<React.SetStateAction<SolarData>>;
  type?: "text" | "number";
}) => {
  return (
    <div className="flex min-w-0 flex-col">
      <label className="sk-label truncate" title={label}>
        {label}
      </label>
      <input
        value={value == 0 ? 0 : value || ""}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) =>
          setSolarData((prev) => ({
            ...prev,
            [field]:
              type === "number"
                ? parseFloat(e.target.value) || 0
                : e.target.value,
          }))
        }
        placeholder={label}
        className="sk-input tabular-nums disabled:hover:border-line"
        type={type}
      />
    </div>
  );
};

export default function SolarDataView({
  solarData,
  setSolarData,
  readOnly = true,
}: SolarDataViewProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
        <Input
          label="Årlig produksjon (kWh)"
          value={solarData.yearlyProd}
          readOnly={readOnly}
          field="yearlyProd"
          setSolarData={setSolarData}
          type="number"
        />
        <Input
          label="Strømpris (kr/kWh)"
          value={solarData.selectedElPrice}
          readOnly={readOnly}
          field="selectedElPrice"
          setSolarData={setSolarData}
          type="number"
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
          type="number"
        />
        <Input
          label="Desired kWh"
          value={solarData.desiredKwh}
          readOnly={readOnly}
          field="desiredKwh"
          setSolarData={setSolarData}
          type="number"
        />
        <Input
          label="Coverage %"
          value={solarData.coveragePercentage}
          readOnly={readOnly}
          field="coveragePercentage"
          setSolarData={setSolarData}
          type="number"
        />
      </div>

      {solarData.checkedRoofData?.length ? (
        <div className="sk-card mt-4 w-full overflow-x-auto">
          <table className="sk-table">
            <thead>
              <tr>
                <th>Tak ID</th>
                <th className="!text-right">Paneler</th>
                <th className="!text-right">Maks paneler</th>
                <th>Retning</th>
                <th className="!text-right">Vinkel</th>
              </tr>
            </thead>
            <tbody>
              {solarData.checkedRoofData?.map((roof, index) => {
                return (
                  <tr key={index}>
                    <td className="font-medium !text-ink">{roof.roofId}</td>
                    <td className="text-right tabular-nums">
                      {roof.adjustedPanelCount}
                    </td>
                    <td className="text-right tabular-nums">
                      {roof.maxPanels}
                    </td>
                    <td>{roof.direction}</td>
                    <td className="text-right tabular-nums">
                      {roof.angle?.toFixed?.(0) ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
