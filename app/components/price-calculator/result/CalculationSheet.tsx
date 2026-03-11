import {
  MountItem,
  PriceOverview,
  SupplierCategory,
  SupplierWithProducts,
} from "@/types/price_table";
import { CalculatorState } from "./CalculatorResults";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getElectricalInstallationItems,
  getMountVolumeReductions,
  getSuppliersWithCategories,
  getTeamCommission,
} from "@/lib/api";
import { MountVolumeReductionType, TeamCommissionType } from "@/lib/types";
import { toast } from "react-toastify";
import { ElectricalInstallationItem } from "../supplier/Table";
import { SolarData } from "../../SolarDataView";
import { supabase } from "@/lib/supabase";
import { ThreeWayCells } from "../ThreeWayCells";

interface CalculationSheetProps {
  calculatorState: CalculatorState;
  suppliersAndProducts: SupplierWithProducts[];
  mountItems: MountItem[];
  solarData?: SolarData;
  setPriceOverview?: (priceOverview: PriceOverview | null) => void;
  leadCompany?: string | null;
  finished: boolean;
  leadId: string;
}

export default function CalculationSheet({
  calculatorState,
  suppliersAndProducts,
  mountItems,
  solarData,
  setPriceOverview,
  leadCompany,
  finished,
  leadId,
}: CalculationSheetProps) {
  const { installerGroupId } = useInstallerGroup();
  const { teamId } = useTeam();
  const [suppliersWithCategories, setSuppliersWithCategories] = useState<
    SupplierCategory[]
  >([]);
  const [eletricalData, setEletricalData] = useState<
    ElectricalInstallationItem[]
  >([]);
  const [mountVolumeReductions, setMountVolumeReductions] = useState<
    MountVolumeReductionType[]
  >([]);
  const [teamCommissions, setTeamCommissions] = useState<TeamCommissionType[]>(
    [],
  );

  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>(
    {},
  );
  const [markupOverrides, setMarkupOverrides] = useState<
    Record<string, number>
  >({});
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>(
    {},
  );
  const [attachments, setAttachments] = useState<Record<string, string>>({});
  const [simulationPdfUrl, setSimulationPdfUrl] = useState<string | null>(null);

  // ── Three-way calculation helpers ────────────────────────────────────────────
  // cost × (1 + markup/100) = total
  // Editing cost   → update priceOverrides, total auto-derives
  // Editing markup → update markupOverrides, total auto-derives
  // Editing total  → back-calculate cost = total / (1 + markup/100), update priceOverrides

  const getFinalPrice = (itemId: string, calculatedCost: number) =>
    priceOverrides[itemId] ?? calculatedCost;

  const getFinalMarkup = (itemId: string, defaultMarkup: number) =>
    markupOverrides[itemId] ?? defaultMarkup;

  const getFinalText = (itemId: string, defaultText: string) =>
    textOverrides[itemId] ?? defaultText;

  const handleCostChange = (itemId: string, value: string) => {
    const cost = Number(value);
    setPriceOverrides((prev) => ({
      ...prev,
      [itemId]: isNaN(cost) ? 0 : cost,
    }));
  };

  const handleMarkupChange = (
    itemId: string,
    value: string,
    currentCost: number,
  ) => {
    const markup = Number(value);
    setMarkupOverrides((prev) => ({
      ...prev,
      [itemId]: isNaN(markup) ? 0 : markup,
    }));
    // cost stays the same; total will re-derive automatically
    void currentCost; // explicitly unused — cost not changed when markup changes
  };

  const handleTotalChange = (
    itemId: string,
    totalValue: string,
    defaultMarkup: number,
  ) => {
    const total = Number(totalValue);
    const markup = getFinalMarkup(itemId, defaultMarkup);
    const impliedCost = markup === -100 ? 0 : total / (1 + markup / 100);
    setPriceOverrides((prev) => ({
      ...prev,
      [itemId]: isNaN(impliedCost) ? 0 : impliedCost,
    }));
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFileUpload = async (itemId: string, file: File) => {
    if (!file || !leadId) {
      toast.warn("Mangler fil eller lead ID for opplasting.");
      return;
    }

    const sanitize = (str: string) =>
      str
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "aa")
        .replace(/Æ/g, "Ae")
        .replace(/Ø/g, "O")
        .replace(/Å/g, "Aa")
        .replace(/[^a-zA-Z0-9._\-]/g, "_");

    const safeItemId = sanitize(itemId);
    const safeFileName = sanitize(file.name);

    toast.info(`Laster opp ${file.name}...`);
    const filePath = `${leadId}/attachments/${safeItemId}-${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("estimate-attachments")
      .upload(filePath, file);

    if (uploadError) {
      toast.error(`Bildeopplasting feilet: ${uploadError.message}`);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("estimate-attachments")
      .getPublicUrl(filePath);

    if (publicUrlData) {
      setAttachments((prev) => ({
        ...prev,
        [itemId]: publicUrlData.publicUrl,
      }));
      toast.success(`${file.name} er lastet opp.`);
    } else {
      toast.error("Kunne ikke hente offentlig URL for filen.");
    }
  };

  const categoryMapping: Record<string, string> = {
    solcellepanel: "solcellemateriell",
    inverter: "solcellemateriell",
    feste: "solcellemateriell",
    "feste-mount": "montering",
    batteri: "solcellemateriell",
    stillase: "stillase",
    ballastein: "ballastein",
    frakt: "frakt",
  };

  const getCategoryMarkup = (categoryName: string) => {
    const mappedName =
      categoryMapping[categoryName.toLowerCase()] || categoryName;
    const category = suppliersWithCategories.find(
      (c) => c.name.toLowerCase() === mappedName.toLowerCase(),
    );
    return category?.markup_percentage || 0;
  };

  const calculateEnovaSupport = () => {
    const eligibleKwp = Math.min(solarData?.kwp ?? 0, 15);
    return eligibleKwp * 2500;
  };

  useEffect(() => {
    if (!installerGroupId || !teamId) return;
    const fetchData = async () => {
      try {
        const [
          categoriesData,
          electricalData,
          reductionsData,
          teamCommissionsData,
        ] = await Promise.all([
          getSuppliersWithCategories(installerGroupId),
          getElectricalInstallationItems(installerGroupId),
          getMountVolumeReductions(installerGroupId),
          getTeamCommission(teamId),
        ]);

        setSuppliersWithCategories(categoriesData);
        setEletricalData(electricalData);
        setMountVolumeReductions(reductionsData);
        setTeamCommissions(teamCommissionsData);
      } catch (error) {
        toast.error("Error fetching data:");
        console.error(error);
      }
    };

    fetchData();
  }, [installerGroupId, teamId]);

  const items = calculatorState.items
    .flatMap((item) => {
      if (!item.supplierId || !item.productId) {
        return [
          {
            id: item.id,
            name: item.displayName,
            price: 0,
            quantity: item.quantity,
            category: "unknown",
            source: "supplier",
            supplier: "Ukjent",
            product: "",
          },
        ];
      }

      const supplier = suppliersAndProducts.find(
        (s) => s.id === item.supplierId,
      );
      const product = supplier?.products.find((p) => p.id === item.productId);

      if (!product) return [];

      const category = product.category?.name?.toLowerCase() || "ukjent";

      const supplierItem = {
        id: item.id + "_supplier",
        name: item.displayName,
        product: product.name,
        supplier: supplier?.name || "Ukjent",
        category: category === "feste" ? "feste" : category,
        quantity: item.quantity,
        source: "supplier",
        price: product.price_ex_vat * item.quantity,
      };

      if (category !== "feste") return [supplierItem];

      const mountMatch = mountItems.find(
        (m) =>
          m.product.id === product.id &&
          m.roof_type?.name === solarData?.selectedRoofType,
      );
      const fallbackMatch = !mountMatch
        ? mountItems.find((m) => m.product.id === product.id)
        : null;
      const finalMountData = mountMatch || fallbackMatch;

      const mountingItem = finalMountData
        ? {
            id: item.id + "_mount",
            name: item.displayName,
            product: product.name,
            supplier: supplier?.name || "Ukjent",
            category: "feste-mount",
            quantity: item.quantity,
            source: "mounting",
            price: finalMountData.price_per * item.quantity,
            roofTypeName: finalMountData.roof_type?.name || "Standard/Fallback",
            mountProductName: finalMountData.product.name,
          }
        : {
            id: item.id + "_mount_empty",
            name: "Montering (pris ikke satt)",
            product: product.name,
            supplier: supplier?.name || "Ukjent",
            category: "feste-mount",
            quantity: item.quantity,
            source: "mounting",
            price: 0,
            roofTypeName: "Ingen match",
          };

      return [supplierItem, mountingItem];
    })
    .filter((i) => i.quantity > 0 && i.supplier !== "Ukjent");

  const supplierItems = items.filter((i) => i.source === "supplier");

  const categoryOrder = Object.keys(categoryMapping);
  supplierItems.sort((a, b) => {
    const indexA = categoryOrder.indexOf(a.category);
    const indexB = categoryOrder.indexOf(b.category);
    if (indexA !== indexB) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
    return a.name.localeCompare(b.name);
  });

  const mountingItems = items.filter((i) => i.source === "mounting");

  const totalSupplierMarkup = supplierItems.reduce((sum, item) => {
    const defaultMarkup = getCategoryMarkup(item.category || "");
    const finalCost = getFinalPrice(item.id, item.price);
    const finalMarkup = getFinalMarkup(item.id, defaultMarkup);
    return sum + finalCost * (finalMarkup / 100);
  }, 0);

  const totalMountingCost = mountingItems.reduce(
    (sum, item) => sum + getFinalPrice(item.id, item.price),
    0,
  );

  const panelCount = solarData?.totalPanels || 0;
  const applicableReduction = mountVolumeReductions.find(
    (r) => panelCount >= r.amount && panelCount <= r.amount2,
  );
  const reductionPercentage = applicableReduction?.reduction || 0;
  const reductionAmount = totalMountingCost * (reductionPercentage / 100);

  const updatedMountingCost = totalMountingCost - reductionAmount;
  const mountingMarkupPercent = getCategoryMarkup("feste-mount");
  const totalMountingMarkup =
    mountingItems.reduce((sum, item) => {
      const defaultMarkup = getCategoryMarkup(item.category || "");
      const finalCost = getFinalPrice(item.id, item.price);
      const finalMarkup = getFinalMarkup(item.id, defaultMarkup);
      return sum + finalCost * (finalMarkup / 100);
    }, 0) -
    reductionAmount *
      (getFinalMarkup("feste-mount-global", mountingMarkupPercent) / 100);

  void updatedMountingCost; // derived via individual rows

  const total = items.reduce((sum, item) => {
    return sum + getFinalPrice(item.id, item.price);
  }, 0);

  const søknadItems = eletricalData.filter(
    (item) => item.category?.name?.toLowerCase() === "søknad",
  );
  const søknadTotal = søknadItems.reduce(
    (sum, item) => sum + (item.price_per || 0),
    0,
  );

  const electricalMarkupDefault = getCategoryMarkup("elektrisk installasjon");

  const solcelleAnleggItems = eletricalData.filter(
    (item) => item.category?.name?.toLowerCase() === "solcelleanlegg",
  );
  const solcelleAnleggBaseTotal = solcelleAnleggItems.reduce(
    (sum, item) => sum + (item.price_per || 0),
    0,
  );

  const inverterCount = supplierItems
    .filter((i) => i.category?.includes("inverter"))
    .reduce((sum, i) => sum + i.quantity, 0);

  const batteryCount = supplierItems
    .filter((i) => i.category?.toLowerCase() === "batteri")
    .reduce((sum, i) => sum + i.quantity, 0);

  const batteryOptions = eletricalData.filter(
    (item) => item.category?.name.toLowerCase() === "batteri",
  );
  const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(
    null,
  );
  const selectedBattery = batteryOptions.find(
    (b) => b.id === selectedBatteryId,
  );
  const batteryBasePrice = selectedBattery?.price_per || 0;

  const additionalCostOptions = eletricalData.filter(
    (item) => item.category?.name?.toLowerCase() === "tilleggskostnader",
  );
  const [additionalCosts, setAdditionalCosts] = useState<
    { id: string; quantity: number }[]
  >([]);

  useEffect(() => {
    if (!solarData?.checkedRoofData) return;
    const isSteepRoof = solarData.checkedRoofData.some((r) => r.angle > 35);
    const brattTakItem = additionalCostOptions.find((ac) =>
      ac.name?.toLowerCase().includes("bratt-tak"),
    );
    if (!brattTakItem) return;
    const hasBrattTak = additionalCosts.some((ac) => ac.id === brattTakItem.id);
    if (isSteepRoof && !hasBrattTak) {
      setAdditionalCosts((prev) => [
        ...prev,
        { id: brattTakItem.id, quantity: 1 },
      ]);
    } else if (!isSteepRoof && hasBrattTak) {
      setAdditionalCosts((prev) =>
        prev.filter((ac) => ac.id !== brattTakItem.id),
      );
    }
  }, [solarData?.checkedRoofData, additionalCosts, additionalCostOptions]);

  const handleAddAdditionalCost = () =>
    setAdditionalCosts((prev) => [...prev, { id: "", quantity: 1 }]);

  const handleRemoveAdditionalCost = (index: number) =>
    setAdditionalCosts((prev) => prev.filter((_, i) => i !== index));

  const handleUpdateAdditionalCost = (
    index: number,
    field: "id" | "quantity",
    value: string | number,
  ) =>
    setAdditionalCosts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );

  // Per-row electrical markup helpers
  const søknadMarkup = getFinalMarkup("søknad_markup", electricalMarkupDefault);
  const solcelleMarkup = getFinalMarkup(
    "solcelle_markup",
    electricalMarkupDefault,
  );
  const batteriMarkup = getFinalMarkup(
    "batteri_markup",
    electricalMarkupDefault,
  );

  const søknadFinalCost = getFinalPrice("søknad", søknadTotal);
  const solcelleAnleggFinalCost = getFinalPrice(
    "solcelle_anlegg",
    solcelleAnleggBaseTotal * inverterCount,
  );
  const batteryFinalCost = getFinalPrice(
    "batteri",
    batteryBasePrice * batteryCount,
  );

  const additionalCostsMarkup = additionalCosts.reduce((sum, ac, index) => {
    const selectedItem = additionalCostOptions.find((i) => i.id === ac.id);
    const base = selectedItem?.price_per || 0;
    const overrideId = `additional_${index}`;
    const markup = getFinalMarkup(
      `additional_markup_${index}`,
      electricalMarkupDefault,
    );
    return sum + getFinalPrice(overrideId, base * ac.quantity) * (markup / 100);
  }, 0);

  const totalInstallationMarkup =
    søknadFinalCost * (søknadMarkup / 100) +
    solcelleAnleggFinalCost * (solcelleMarkup / 100) +
    batteryFinalCost * (batteriMarkup / 100) +
    additionalCostsMarkup;

  const totalWithInstallation =
    total +
    søknadFinalCost * (1 + søknadMarkup / 100) +
    solcelleAnleggFinalCost * (1 + solcelleMarkup / 100) +
    batteryFinalCost * (1 + batteriMarkup / 100) +
    additionalCosts.reduce((sum, ac, index) => {
      const selectedItem = additionalCostOptions.find((i) => i.id === ac.id);
      const base = selectedItem?.price_per || 0;
      const overrideId = `additional_${index}`;
      const markup = getFinalMarkup(
        `additional_markup_${index}`,
        electricalMarkupDefault,
      );
      return (
        sum + getFinalPrice(overrideId, base * ac.quantity) * (1 + markup / 100)
      );
    }, 0);

  const subTotalForCommission =
    totalWithInstallation +
    totalSupplierMarkup +
    totalMountingMarkup -
    reductionAmount;

  const applicableCommission = teamCommissions.find(
    (c) =>
      panelCount >= c.amount && (c.amount2 ? panelCount <= c.amount2 : true),
  );
  const commissionPercentage = applicableCommission?.commission || 0;
  const commissionAmount = subTotalForCommission * (commissionPercentage / 100);
  const finalCommissionAmount = getFinalPrice(
    "team_commission",
    commissionAmount,
  );

  const displayCommissionPercentage =
    priceOverrides["team_commission"] != null
      ? (finalCommissionAmount / subTotalForCommission) * 100
      : commissionPercentage;

  const calculatedEnovaSupport = calculateEnovaSupport();
  const grandTotal = subTotalForCommission + finalCommissionAmount;

  const priceOverview = useMemo(() => {
    return {
      suppliers: supplierItems.map((item) => {
        const defaultMarkup = getCategoryMarkup(item.category || "");
        const markup = getFinalMarkup(item.id, defaultMarkup);
        const cost = getFinalPrice(item.id, item.price);
        return {
          id: item.id,
          name: item.name,
          supplier: item.supplier,
          product: getFinalText(item.id, item.product),
          category: item.category,
          quantity: item.quantity,
          priceWithMarkup: cost * (1 + markup / 100),
          attachmentUrl: attachments[item.id],
        };
      }),
      mounting: mountingItems.map((item) => {
        const defaultMarkup = getCategoryMarkup(item.category || "");
        const markup = getFinalMarkup(item.id, defaultMarkup);
        const cost = getFinalPrice(item.id, item.price);
        return {
          id: item.id,
          name: item.name,
          supplier: item.supplier,
          product: getFinalText(item.id, item.product),
          category: item.category,
          quantity: item.quantity,
          priceWithMarkup: cost * (1 + markup / 100),
          attachmentUrl: attachments[item.id],
        };
      }),
      installation: {
        søknad: {
          priceWithMarkup: søknadFinalCost * (1 + søknadMarkup / 100),
          attachmentUrl: attachments["søknad"],
        },
        solcelleAnlegg: {
          priceWithMarkup: solcelleAnleggFinalCost * (1 + solcelleMarkup / 100),
          attachmentUrl: attachments["solcelle_anlegg"],
        },
        battery: {
          selectedBatteryId,
          priceWithMarkup: batteryFinalCost * (1 + batteriMarkup / 100),
          attachmentUrl: attachments["batteri"],
        },
        additionalCosts: additionalCosts.map((ac, index) => {
          const selectedItem = additionalCostOptions.find(
            (i) => i.id === ac.id,
          );
          const base = selectedItem?.price_per || 0;
          const overrideId = `additional_${index}`;
          const markup = getFinalMarkup(
            `additional_markup_${index}`,
            electricalMarkupDefault,
          );
          const finalCost = getFinalPrice(overrideId, base * ac.quantity);
          return {
            id: ac.id,
            name: selectedItem?.name || "",
            quantity: ac.quantity,
            priceWithMarkup: finalCost * (1 + markup / 100),
            attachmentUrl: attachments[overrideId],
          };
        }),
      },
      total: grandTotal,
      "total inkl. alt": Number(grandTotal * 1.25),
      simulationPdfUrl,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    supplierItems,
    mountingItems,
    additionalCosts,
    selectedBatteryId,
    totalWithInstallation,
    grandTotal,
    calculatedEnovaSupport,
    attachments,
    simulationPdfUrl,
    priceOverrides,
    markupOverrides,
  ]);

  const prevPriceOverviewString = useRef<string | null>(null);
  useEffect(() => {
    if (!setPriceOverview) return;
    const priceOverviewString = JSON.stringify(priceOverview);
    if (priceOverviewString !== prevPriceOverviewString.current) {
      setPriceOverview(priceOverview);
      prevPriceOverviewString.current = priceOverviewString;
    }
  }, [priceOverview, setPriceOverview]);

  const handleRemoveAttachment = (itemId: string) => {
    setAttachments((prev) => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  const handleSimulationPdfUpload = async (file: File) => {
    if (!file || !leadId) {
      toast.warn("Mangler fil eller lead ID for opplasting.");
      return;
    }
    const sanitize = (str: string) =>
      str
        .replace(/æ/g, "ae")
        .replace(/ø/g, "o")
        .replace(/å/g, "aa")
        .replace(/Æ/g, "Ae")
        .replace(/Ø/g, "O")
        .replace(/Å/g, "Aa")
        .replace(/[^a-zA-Z0-9._\-]/g, "_");

    const safeFileName = sanitize(file.name);
    toast.info(`Laster opp ${file.name}...`);
    const filePath = `${leadId}/simulation/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from("estimate-attachments")
      .upload(filePath, file);
    if (uploadError) {
      toast.error(`Opplasting feilet: ${uploadError.message}`);
      return;
    }
    const { data: publicUrlData } = supabase.storage
      .from("estimate-attachments")
      .getPublicUrl(filePath);
    if (!publicUrlData) {
      toast.error("Kunne ikke hente offentlig URL.");
      return;
    }
    setSimulationPdfUrl(publicUrlData.publicUrl);
    toast.success(`${file.name} er lastet opp og lagret.`);
  };

  const handleRemoveSimulationPdf = async () => {
    setSimulationPdfUrl(null);
    toast.success("Simulerings-PDF fjernet.");
  };

  const getFileName = (url: string) =>
    url.split("/").pop()?.replace(/^\d+-/, "") ?? "";

  return (
    <div className="mt-8 border rounded-lg bg-white shadow p-4">
      <h3 className="text-lg font-medium mb-3">PRISOVERSIKT</h3>
      {finished && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-600">Simulerings-PDF:</span>
          {simulationPdfUrl ? (
            <div className="flex items-center gap-1">
              <a
                href={simulationPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                {getFileName(simulationPdfUrl)}
              </a>
              <button
                onClick={handleRemoveSimulationPdf}
                className="text-red-400 hover:text-red-600 font-bold text-sm"
                title="Fjern PDF"
              >
                ×
              </button>
            </div>
          ) : (
            <input
              type="file"
              className="text-xs"
              onChange={(e) =>
                e.target.files && handleSimulationPdfUpload(e.target.files[0])
              }
            />
          )}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Navn</th>
            <th className="p-2 text-left">Antall</th>
            <th className="p-2 text-right">Kostnad eks. mva</th>
            <th className="p-2 text-right">Påslag %</th>
            <th className="p-2 text-right">Total eks. mva</th>
            {finished && <th className="p-2 text-left">Vedlegg</th>}
          </tr>
        </thead>
        <tbody>
          {/* ── LEVERANDØRER ── */}
          <tr>
            <td colSpan={finished ? 6 : 5}>
              <h2 className="p-1 font-bold">LEVERANDØRER</h2>
            </td>
          </tr>
          {supplierItems.map((item) => {
            const defaultMarkup = getCategoryMarkup(item.category || "");
            const displayValue = `${item.name} - ${item.product}`;
            return (
              <tr key={item.id}>
                <td className="p-2 flex flex-row items-center gap-1">
                  <textarea
                    value={getFinalText(item.id, displayValue)}
                    onChange={(e) =>
                      setTextOverrides((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    className="w-full bg-gray-100 p-1 border border-gray-200"
                  />
                  <p>-</p>
                  <p>{item.supplier}</p>
                </td>
                <td className="p-2 text-right">{item.quantity} stk.</td>
                <ThreeWayCells
                  itemId={item.id}
                  defaultCost={item.price}
                  defaultMarkup={defaultMarkup}
                  priceOverrides={priceOverrides}
                  markupOverrides={markupOverrides}
                  onCostChange={handleCostChange}
                  onMarkupChange={handleMarkupChange}
                  onTotalChange={handleTotalChange}
                  finished={finished}
                  showAttachment={true}
                  attachments={attachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  onFileUpload={handleFileUpload}
                />
              </tr>
            );
          })}
          <tr className="text-gray-600">
            <td colSpan={finished ? 5 : 4} className="p-2">
              Total leverandør påslag
            </td>
            <td className="p-2 text-right">
              {totalSupplierMarkup.toFixed(0)} kr
            </td>
          </tr>

          {/* ── MONTERING ── */}
          <tr>
            <td colSpan={finished ? 6 : 5}>
              <h2 className="p-1 font-bold">MONTERING</h2>
            </td>
          </tr>
          {mountingItems.map((item) => {
            const defaultMarkup = getCategoryMarkup(item.category || "");
            const defaultText = `Paneler og fester for ${solarData?.selectedRoofType ?? ""}`;
            return (
              <tr key={item.id}>
                <td className="p-2">
                  <textarea
                    value={getFinalText(item.id, defaultText)}
                    onChange={(e) =>
                      setTextOverrides((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    className="w-full bg-gray-100 p-1 border border-gray-200"
                  />
                </td>
                <td className="p-2 text-right">{item.quantity} stk.</td>
                <ThreeWayCells
                  itemId={item.id}
                  defaultCost={item.price}
                  defaultMarkup={defaultMarkup}
                  showAttachment={true}
                  priceOverrides={priceOverrides}
                  markupOverrides={markupOverrides}
                  onCostChange={handleCostChange}
                  onMarkupChange={handleMarkupChange}
                  onTotalChange={handleTotalChange}
                  finished={finished}
                  attachments={attachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  onFileUpload={handleFileUpload}
                />
              </tr>
            );
          })}
          {reductionAmount > 0 && (
            <tr className="text-gray-600">
              <td colSpan={finished ? 5 : 4} className="p-2">
                Volumreduksjon ({reductionPercentage}%)
              </td>
              <td className="p-2 text-right">
                -{reductionAmount.toFixed(0)} kr
              </td>
            </tr>
          )}
          <tr className="text-gray-600">
            <td colSpan={finished ? 5 : 4} className="p-2">
              Total montering påslag
            </td>
            <td className="p-2 text-right">
              {totalMountingMarkup.toFixed(0)} kr
            </td>
          </tr>

          {/* ── INSTALLASJON ── */}
          <tr>
            <td colSpan={finished ? 6 : 5}>
              <h2 className="p-1 font-bold">INSTALLASJON</h2>
            </td>
          </tr>
          {søknadTotal > 0 && (
            <tr>
              <td className="p-2">Søknad</td>
              <td className="p-2 text-right">1 stk.</td>
              <ThreeWayCells
                itemId="søknad"
                defaultCost={søknadTotal}
                defaultMarkup={electricalMarkupDefault}
                showAttachment={true}
                priceOverrides={priceOverrides}
                markupOverrides={markupOverrides}
                onCostChange={handleCostChange}
                onMarkupChange={handleMarkupChange}
                onTotalChange={handleTotalChange}
                finished={finished}
                attachments={attachments}
                onRemoveAttachment={handleRemoveAttachment}
                onFileUpload={handleFileUpload}
              />
            </tr>
          )}
          {inverterCount > 0 && (
            <tr>
              <td className="p-2">Solcelleanlegg - arbeid per inverter</td>
              <td className="p-2 text-right">{inverterCount} stk.</td>
              <ThreeWayCells
                itemId="solcelle_anlegg"
                defaultCost={solcelleAnleggBaseTotal * inverterCount}
                defaultMarkup={electricalMarkupDefault}
                showAttachment={true}
                priceOverrides={priceOverrides}
                markupOverrides={markupOverrides}
                onCostChange={handleCostChange}
                onMarkupChange={handleMarkupChange}
                onTotalChange={handleTotalChange}
                finished={finished}
                attachments={attachments}
                onRemoveAttachment={handleRemoveAttachment}
                onFileUpload={handleFileUpload}
              />
            </tr>
          )}
          {batteryCount > 0 && (
            <tr>
              <td className="p-2">
                Batteri{" "}
                <select
                  className="ml-2 border rounded p-1"
                  value={selectedBatteryId || ""}
                  onChange={(e) => setSelectedBatteryId(e.target.value)}
                >
                  <option value="">Arbeidsmetode</option>
                  {batteryOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({(b.price_per || 0).toFixed(0)} kr)
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2 text-right">{batteryCount} stk.</td>
              <ThreeWayCells
                itemId="batteri"
                defaultCost={batteryBasePrice * batteryCount}
                defaultMarkup={electricalMarkupDefault}
                showAttachment={true}
                priceOverrides={priceOverrides}
                markupOverrides={markupOverrides}
                onCostChange={handleCostChange}
                onMarkupChange={handleMarkupChange}
                onTotalChange={handleTotalChange}
                finished={finished}
                attachments={attachments}
                onRemoveAttachment={handleRemoveAttachment}
                onFileUpload={handleFileUpload}
              />
            </tr>
          )}
          {additionalCosts.map((ac, index) => {
            const selectedItem = additionalCostOptions.find(
              (i) => i.id === ac.id,
            );
            const base = selectedItem?.price_per || 0;
            const overrideId = `additional_${index}`;
            return (
              <tr key={index}>
                <td>
                  <button
                    onClick={() => handleRemoveAdditionalCost(index)}
                    className="pr-2 py-2 text-slate-500 hover:text-red-500 font-bold"
                  >
                    ×
                  </button>
                  <select
                    className="border rounded p-1"
                    value={ac.id}
                    onChange={(e) =>
                      handleUpdateAdditionalCost(index, "id", e.target.value)
                    }
                  >
                    <option value="">Velg tilleggskostnad</option>
                    {additionalCostOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({(item.price_per || 0).toFixed(0)} kr)
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="1"
                    value={ac.quantity}
                    onChange={(e) =>
                      handleUpdateAdditionalCost(
                        index,
                        "quantity",
                        Number(e.target.value),
                      )
                    }
                    className="w-18 border rounded p-1 text-left"
                  />
                </td>
                <ThreeWayCells
                  itemId={overrideId}
                  defaultCost={base * ac.quantity}
                  defaultMarkup={electricalMarkupDefault}
                  showAttachment={true}
                  priceOverrides={priceOverrides}
                  markupOverrides={markupOverrides}
                  onCostChange={handleCostChange}
                  onMarkupChange={handleMarkupChange}
                  onTotalChange={handleTotalChange}
                  finished={finished}
                  attachments={attachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  onFileUpload={handleFileUpload}
                />
              </tr>
            );
          })}
          <tr>
            <td colSpan={finished ? 6 : 5}>
              <button
                onClick={handleAddAdditionalCost}
                className="text-red-500 p-2"
              >
                Legg til tilleggskostnader
              </button>
            </td>
          </tr>
          <tr className="text-gray-600">
            <td colSpan={finished ? 5 : 4} className="p-2">
              Total installasjon påslag
            </td>
            <td className="p-2 text-right">
              {totalInstallationMarkup.toFixed(0)} kr
            </td>
          </tr>

          {/* ── PROVISJON ── */}
          <tr>
            <td colSpan={finished ? 6 : 5}>
              <h2 className="p-1 font-bold">Soleklart Salgsprovisjon</h2>
            </td>
          </tr>
          {commissionAmount > 0 && (
            <tr>
              <td className="p-2">
                Kommisjon ({displayCommissionPercentage.toFixed(0)}%)
              </td>
              <td className="p-2 text-right"></td>
              <td className="p-2 text-right"></td>
              <td className="p-2 text-right"></td>
              <td className="p-2 text-right">
                <input
                  className="text-right w-32 bg-gray-100 p-1 border border-gray-200"
                  value={finalCommissionAmount.toFixed(0)}
                  onChange={(e) =>
                    handleCostChange("team_commission", e.target.value)
                  }
                />
                {" kr"}
              </td>
              {finished && <td className="p-2"></td>}
            </tr>
          )}

          <tr>
            <td className="p-2" colSpan={finished ? 6 : 5}></td>
          </tr>

          {/* ── TOTALER ── */}
          {leadCompany ? (
            <tr>
              <td className="p-2 font-semibold">Total kostnad eks. mva</td>
              <td colSpan={finished ? 4 : 3} className="p-2 text-right"></td>
              <td className="p-2 text-right font-semibold">
                {grandTotal.toFixed(0)} kr
              </td>
              {finished && <td className="p-2"></td>}
            </tr>
          ) : (
            <>
              <tr>
                <td className="p-2 font-semibold">Total kostnad eks. mva</td>
                <td colSpan={finished ? 4 : 3} className="p-2 text-right"></td>
                <td className="p-2 text-right font-semibold">
                  {grandTotal.toFixed(0)} kr
                </td>
                {finished && <td className="p-2"></td>}
              </tr>
              <tr>
                <td className="p-2 font-semibold">Total kostnad inkl. mva</td>
                <td colSpan={finished ? 4 : 3} className="p-2 text-right"></td>
                <td className="p-2 text-right font-semibold">
                  {(grandTotal * 1.25).toFixed(0)} kr
                </td>
                {finished && <td className="p-2"></td>}
              </tr>
              <tr>
                <td className="p-2" colSpan={finished ? 6 : 5}></td>
              </tr>
              <tr>
                <td className="p-2">Enova støtte</td>
                <td colSpan={finished ? 4 : 3} className="p-2 text-right"></td>
                <td className="p-2 text-right">
                  {calculatedEnovaSupport.toFixed(0)} kr
                </td>
                {finished && <td className="p-2"></td>}
              </tr>
              <tr>
                <td className="p-2" colSpan={finished ? 6 : 5}></td>
              </tr>
              <tr>
                <td className="p-2">
                  Total kostnad inkl. mva og Enova-støtte (privat)
                </td>
                <td colSpan={finished ? 4 : 3} className="p-2 text-right"></td>
                <td className="p-2 text-right">
                  {(grandTotal * 1.25 - calculatedEnovaSupport).toFixed(0)} kr
                </td>
                {finished && <td className="p-2"></td>}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
