import { SolarData } from "../../SolarDataView";
import { useEffect, useState } from "react";
import { getRoofTypes } from "@/lib/api";
import { RoofType } from "@/lib/types";

interface FacilityInfoProps {
  solarData?: SolarData;
  setSolarData?: (data: SolarData) => void;
}

export default function FacilityInfo({
  solarData,
  setSolarData,
}: FacilityInfoProps) {
  const [roofTypes, setRoofTypes] = useState<RoofType[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getRoofTypes();
      setRoofTypes(data);
    };

    fetchData();
  }, []);

  const yearlyCo2Saved = () => {
    if (!solarData?.yearlyProd) return 0;
    return (solarData.yearlyProd * 0.207).toFixed(2);
  };

  const selfProduced = () => {
    if (!solarData?.desiredKwh || !solarData?.yearlyProd) return 0;
    return ((solarData.desiredKwh / solarData.yearlyProd) * 100).toFixed(2);
  };

  const enovaSupport = () => {
    const eligibleKwp = Math.min(solarData?.kwp ?? 0, 15);
    return (eligibleKwp * 2500).toFixed(2);
  };

  return (
    <table className="border border-collapse w-1/4 h-fit">
      <thead>
        <tr>
          <td colSpan={2} className="p-2 text-center">
            <h2>Info om anlegget</h2>
          </td>
        </tr>
      </thead>

      <tbody>
        {!solarData?.yearlyProd && (
          <>
            <tr>
              <td className="border p-1 w-1/2">kWp</td>
              <td className="border p-1 w-1/2">{solarData?.kwp ?? 0}</td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Helning på tak</td>
              <td className="border p-1 w-1/2">
                <input
                  type="number"
                  onChange={(e) => {
                    if (!solarData || !setSolarData) return;
                    const newCheckedRoofData = [
                      ...(solarData.checkedRoofData ?? []),
                    ];
                    if (newCheckedRoofData.length === 0) {
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
                />
              </td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Taktype</td>
              <td className="border p-1 w-1/2">
                <select
                  value={solarData?.selectedRoofType ?? ""}
                  onChange={(e) =>
                    setSolarData?.({
                      ...solarData!,
                      selectedRoofType: e.target.value,
                    })
                  }
                  className=" w-full"
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
          </>
        )}

        {solarData?.yearlyProd && (
          <>
            <tr>
              <td className="border p-1 w-1/2">Årlig kWh produksjon</td>
              <td className="border p-1 w-1/2">
                {solarData.yearlyProd ?? 0} kWh
              </td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Årlig CO₂ spart (kg)</td>
              <td className="border p-1 w-1/2">{yearlyCo2Saved()} kg</td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Selvprodusert (%)</td>
              <td className="border p-1 w-1/2">{selfProduced()} %</td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Eget forbruk</td>
              <td className="border p-1 w-1/2">
                {solarData.yearlyCost ?? 0} kWh
              </td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Total besparing 30 år</td>
              <td className="border p-1 w-1/2">
                {solarData.yearlyCost2 ? solarData.yearlyCost2 * 30 : 0} kr
              </td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Årlig besparing</td>
              <td className="border p-1 w-1/2">
                {solarData.yearlyCost2 ?? 0} kr
              </td>
            </tr>

            <tr>
              <td className="border p-1 w-1/2">Enova støtte</td>
              <td className="border p-1 w-1/2">{enovaSupport()}</td>
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
