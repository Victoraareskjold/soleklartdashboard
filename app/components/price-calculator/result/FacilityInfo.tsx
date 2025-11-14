import { getPanelWp } from "@/utils/getPanelWp";
import { SolarData } from "../../SolarDataView";

interface FacilityInfoProps {
  solarData?: SolarData;
}

export default function FacilityInfo({ solarData }: FacilityInfoProps) {
  const getkWp = () => {
    if (!solarData?.selectedPanelType || !solarData?.totalPanels) return 0;
    const watt = getPanelWp(solarData.selectedPanelType);
    return (watt * solarData.totalPanels) / 1000;
  };

  const yearlyCo2Saved = () => {
    if (!solarData?.yearlyProd) return 0;
    return solarData.yearlyProd * 0.207;
  };

  //Selvprodusert i % = ([årlig Kwh produksjon] / [Eget forbruk]) * 100
  const selfProduced = () => {
    if (!solarData) return 0;
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
          <td className="border p-1 w-1/2">{getkWp()}</td>
        </tr>

        {solarData && (
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
              <td className="border p-1 w-1/2">
                {solarData.coveragePercentage ?? 0} %
              </td>
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
              <td className="border p-1 w-1/2">Kommer…</td>
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
