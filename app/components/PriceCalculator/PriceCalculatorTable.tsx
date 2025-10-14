import LoadingScreen from "../LoadingScreen";
import { PriceTable } from "@/types/price";
import RoofSection from "./sections/RoofSection";

type Props = {
  table: PriceTable;
  items: PriceTable["prices"];
  totalPanels?: number;
};

export default function PriceCalculatorTable({
  table,
  items,
  totalPanels = 1,
}: Props) {
  if (!table) return <LoadingScreen />;

  return (
    <div>
      <RoofSection
        roofTypes={items.roofTypes ?? []}
        totalPanels={totalPanels}
      />
    </div>
  );
}
