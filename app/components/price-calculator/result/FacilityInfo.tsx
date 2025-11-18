import { getPanelWp } from "@/utils/getPanelWp";
import { SolarData } from "../../SolarDataView";
import { useEffect, useState } from "react";
import { getRoofTypes } from "@/lib/api";
import { RoofType } from "@/lib/types";

interface FacilityInfoProps {
  solarData?: SolarData;
  setSolarData?: (data: SolarData) => void; // <- må inn
}

export default function FacilityInfo({
  solarData,
  setSolarData,
}: FacilityInfoProps) {
  const [kWp, setkWp] = useState(0);
  const [roofTypes, setRoofTypes] = useState<RoofType[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getRoofTypes();
      setRoofTypes(data);

      if (!solarData?.selectedPanelType || !solarData?.totalPanels) {
        setkWp(0);
        return;
      }

      const watt = getPanelWp(solarData.selectedPanelType);
      setkWp((watt * solarData.totalPanels) / 1000);
    };

    fetchData();
  }, [solarData?.selectedPanelType, solarData?.totalPanels]);

  const yearlyCo2Saved = () => {
    if (!solarData?.yearlyProd) return 0;
    return (solarData.yearlyProd * 0.207).toFixed(2);
  };

  const selfProduced = () => {
    if (!solarData?.desiredKwh || !solarData?.yearlyProd) return 0;
    return ((solarData.desiredKwh / solarData.yearlyProd) * 100).toFixed(2);
  };

  const enovaSupport = () => {
    const eligibleKwp = Math.min(kWp, 15);
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
        <tr>
          <td className="border p-1 w-1/2">kWp</td>
          <td className="border p-1 w-1/2">{kWp}</td>
        </tr>

        <tr>
          <td className="border p-1 w-1/2">Valgt taktype</td>
          <td className="border p-1 w-1/2">
            <select
              value={solarData?.selectedRoofType ?? ""}
              onChange={(e) =>
                setSolarData?.({
                  ...solarData!,
                  selectedRoofType: e.target.value,
                })
              }
              className="border p-1 w-full"
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
