import { SolarData } from "../../SolarDataView";
import { useEffect, useState } from "react";
import { getRoofTypes } from "@/lib/api";
import { RoofType } from "@/lib/types";

interface FacilityInfoProps {
  solarData?: SolarData;
  setSolarData?: (data: SolarData) => void;
  ownConsumption?: number | null;
}

export default function FacilityInfo({
  solarData,
  setSolarData,
  ownConsumption,
}: FacilityInfoProps) {
  const [roofTypes, setRoofTypes] = useState<RoofType[]>([]);

  const voltageOptions = [
    { label: "230V", value: 230 },
    { label: "400V", value: 400 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const data = await getRoofTypes();
      setRoofTypes(data);
    };

    fetchData();
  }, []);

  const selfProduced = () => {
    if (!solarData?.yearlyProd || !ownConsumption) return 0.0;
    if (ownConsumption === 0) return 0.0;
    return ((solarData.yearlyProd / ownConsumption) * 100).toFixed(2);
  };

  const enovaSupport = () => {
    const eligibleKwp = Math.min(solarData?.kwp ?? 0, 15);
    return (eligibleKwp * 2500).toFixed(2);
  };

  return (
    <div className="h-fit w-72 shrink-0 overflow-hidden rounded-xl border border-line bg-surface">
      <table className="sk-table">
        <thead>
          <tr>
            <th colSpan={2} className="py-2!">
              <h2 className="font-sans! text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Info om anlegget
              </h2>
            </th>
          </tr>
        </thead>

        <tbody>
          {solarData?.yearlyProd === undefined ? (
            <>
              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  kWp
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  {solarData?.kwp?.toFixed(1) ?? 0}
                </td>
              </tr>
              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  Helning på tak
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  <input
                    type="number"
                    onChange={(e) => {
                      if (!solarData || !setSolarData) return;
                      const newCheckedRoofData = [
                        ...(solarData.checkedRoofData ?? []),
                      ];
                      if (!newCheckedRoofData.length) {
                        newCheckedRoofData.push({
                          roofId: "",
                          adjustedPanelCount: 0,
                          maxPanels: 0,
                          direction: "",
                          angle: 0,
                        });
                      }
                      newCheckedRoofData[0] = {
                        ...newCheckedRoofData[0],
                        angle: Number(e.target.value),
                      };
                      setSolarData({
                        ...solarData,
                        checkedRoofData: newCheckedRoofData,
                      });
                    }}
                    value={solarData?.checkedRoofData?.[0]?.angle ?? 0}
                    className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                  />
                </td>
              </tr>
              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  Taktype
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  <select
                    value={solarData?.selectedRoofType ?? ""}
                    onChange={(e) =>
                      setSolarData?.({
                        ...solarData!,
                        selectedRoofType: e.target.value,
                      })
                    }
                    className="h-8 w-full rounded-md border border-line bg-white pl-2 text-left text-sm font-normal text-ink hover:border-gray-300"
                  >
                    <option value="">Velg taktype...</option>
                    {roofTypes.map((roof) => (
                      <option key={roof.id} value={roof.name}>
                        {roof.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>

              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  Spenning
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  <select
                    value={solarData?.voltage ?? 230}
                    onChange={(e) => {
                      if (setSolarData && solarData) {
                        setSolarData({
                          ...solarData,
                          voltage: Number(e.target.value),
                        });
                      }
                    }}
                    className="h-8 w-full rounded-md border border-line bg-white pl-2 text-left text-sm font-normal text-ink hover:border-gray-300"
                  >
                    {voltageOptions.map((volt) => (
                      <option key={volt.label} value={volt.value}>
                        {volt.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  kWp
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  <input
                    type="number"
                    value={solarData?.kwp?.toFixed(1) ?? 0}
                    min={0}
                    onChange={(e) => {
                      if (!solarData || !setSolarData) return;
                      setSolarData({
                        ...solarData,
                        kwp: Number(e.target.value),
                        manualKwp: Number(e.target.value),
                        kwpMode: "manual",
                      });
                    }}
                    className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                  />
                </td>
              </tr>
              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  Årlig kWh produksjon
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  <input
                    type="number"
                    value={solarData?.yearlyProd ?? 0}
                    min={0}
                    onChange={(e) => {
                      if (!solarData || !setSolarData) return;
                      setSolarData({
                        ...solarData,
                        yearlyProd: Number(e.target.value),
                      });
                    }}
                    className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                  />
                </td>
              </tr>
              {/*  <tr>
              <td className="w-[45%] py-1.5 text-xs font-medium text-muted">Eget forbruk (kWh)</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                {solarData?.desiredKwh?.toLocaleString("nb-NO") ?? 0}
              </td>
            </tr> */}
              {/* <tr>
              <td className="w-[45%] py-1.5 text-xs font-medium text-muted">Årlig CO₂ spart (kg)</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-ink">{yearlyCo2Saved()} kg</td>
            </tr> */}
              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  Selvprodusert (%)
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  {selfProduced()} %
                </td>
              </tr>
              {/* <tr>
              <td className="w-[45%] py-1.5 text-xs font-medium text-muted">Eget forbruk</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                {solarData.yearlyCost ?? "0"} kWh
              </td>
            </tr> */}
              {/* <tr>
              <td className="w-[45%] py-1.5 text-xs font-medium text-muted">Total besparing 30 år</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                {solarData.yearlyCost2 ? solarData.yearlyCost2 * 30 : "0"} kr
              </td>
            </tr> */}
              {/* <tr>
              <td className="w-[45%] py-1.5 text-xs font-medium text-muted">Årlig besparing</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                {solarData.yearlyCost2 ?? "0"} kr
              </td>
            </tr> */}
              <tr>
                <td className="w-[45%] py-1.5 text-xs font-medium text-muted">
                  Enova støtte
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold text-ink">
                  {enovaSupport()}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
