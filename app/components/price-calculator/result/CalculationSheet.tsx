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
import { FileText, Plus, X } from "lucide-react";

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
      totalOverride: null,
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
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gray-50/60 px-3 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink">
            PRISOVERSIKT
          </h3>
          {finished && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">
                Simulerings-PDF:
              </span>
              {simulationPdfUrl ? (
                <div className="flex items-center gap-1 rounded-md border border-line bg-white py-0.5 pl-2 pr-0.5">
                  <FileText size={13} className="text-brand" />
                  <a
                    href={simulationPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-48 truncate text-xs font-medium text-brand hover:underline"
                  >
                    {getFileName(simulationPdfUrl)}
                  </a>
                  <button
                    onClick={handleRemoveSimulationPdf}
                    className="inline-flex size-5 items-center justify-center rounded text-muted hover:bg-red-50 hover:text-red-600"
                    title="Fjern PDF"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  className="text-xs text-muted file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink file:shadow-card hover:file:bg-gray-100"
                  onChange={(e) =>
                    e.target.files &&
                    handleSimulationPdfUpload(e.target.files[0])
                  }
                />
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="sk-table">
            <thead>
              <tr>
                <th className="py-2!">Navn</th>
                <th className="w-20 py-2! text-right!">Antall</th>
                <th className="w-32 py-2! text-right!">Kostnad eks. mva</th>
                <th className="w-28 py-2! text-right!">Påslag %</th>
                <th className="w-36 py-2! text-right!">Total eks. mva</th>
                {finished && <th className="w-36 py-2!">Vedlegg</th>}
              </tr>
            </thead>
            <tbody>
              {/* ── LEVERANDØRER ── */}
              <tr className="hover:bg-transparent!">
                <td
                  colSpan={finished ? 6 : 5}
                  className="border-b border-line! bg-gray-50/70 px-3! pb-1.5! pt-4! text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  <h2 className="font-sans! text-inherit">LEVERANDØRER</h2>
                </td>
              </tr>
              {supplierItems.map((item) => {
                const defaultMarkup = getCategoryMarkup(item.category || "");
                const displayValue = `${item.name} - ${item.product}`;
                return (
                  <tr key={item.id}>
                    <td className="py-1.5">
                      <div className="flex flex-row items-center gap-2">
                        <textarea
                          value={getFinalText(item.id, displayValue)}
                          onChange={(e) =>
                            setTextOverrides((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="block w-full min-w-0 resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink field-sizing-content hover:border-line hover:bg-white focus:bg-white"
                        />
                        <span className="sk-badge sk-badge-neutral shrink-0">
                          {item.supplier}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-body">
                      {item.quantity} stk.
                    </td>
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
              <tr className="bg-gray-50/40 hover:bg-gray-50/40!">
                <td
                  colSpan={finished ? 5 : 4}
                  className="py-2! text-xs font-medium text-muted"
                >
                  Total leverandør påslag
                </td>
                <td className="whitespace-nowrap py-2! text-right text-xs font-semibold tabular-nums text-body">
                  {totalSupplierMarkup.toFixed(0)} kr
                </td>
              </tr>

              {/* ── MONTERING ── */}
              <tr className="hover:bg-transparent!">
                <td
                  colSpan={finished ? 6 : 5}
                  className="border-b border-line! bg-gray-50/70 px-3! pb-1.5! pt-4! text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  <h2 className="font-sans! text-inherit">MONTERING</h2>
                </td>
              </tr>
              {mountingItems.map((item) => {
                const defaultMarkup = getCategoryMarkup(item.category || "");
                const defaultText = `Paneler og fester for ${solarData?.selectedRoofType ?? ""}`;
                return (
                  <tr key={item.id}>
                    <td className="py-1.5">
                      <textarea
                        value={getFinalText(item.id, defaultText)}
                        onChange={(e) =>
                          setTextOverrides((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        className="block w-full min-w-0 resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink field-sizing-content hover:border-line hover:bg-white focus:bg-white"
                      />
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-body">
                      {item.quantity} stk.
                    </td>
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
                <tr className="bg-gray-50/40 hover:bg-gray-50/40!">
                  <td
                    colSpan={finished ? 5 : 4}
                    className="py-2! text-xs font-medium text-muted"
                  >
                    Volumreduksjon ({reductionPercentage}%)
                  </td>
                  <td className="whitespace-nowrap py-2! text-right text-xs font-semibold tabular-nums text-body">
                    -{reductionAmount.toFixed(0)} kr
                  </td>
                </tr>
              )}
              <tr className="bg-gray-50/40 hover:bg-gray-50/40!">
                <td
                  colSpan={finished ? 5 : 4}
                  className="py-2! text-xs font-medium text-muted"
                >
                  Total montering påslag
                </td>
                <td className="whitespace-nowrap py-2! text-right text-xs font-semibold tabular-nums text-body">
                  {totalMountingMarkup.toFixed(0)} kr
                </td>
              </tr>

              {/* ── INSTALLASJON ── */}
              <tr className="hover:bg-transparent!">
                <td
                  colSpan={finished ? 6 : 5}
                  className="border-b border-line! bg-gray-50/70 px-3! pb-1.5! pt-4! text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  <h2 className="font-sans! text-inherit">INSTALLASJON</h2>
                </td>
              </tr>
              {søknadTotal > 0 && (
                <tr>
                  <td className="py-1.5 text-ink">Søknad</td>
                  <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-body">
                    1 stk.
                  </td>
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
                  <td className="py-1.5 text-ink">
                    Solcelleanlegg - arbeid per inverter
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-body">
                    {inverterCount} stk.
                  </td>
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
                  <td className="py-1.5 text-ink">
                    Batteri{" "}
                    <select
                      className="ml-2 h-8 rounded-md border border-line bg-white pl-2 text-sm text-ink hover:border-gray-300"
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
                  <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-body">
                    {batteryCount} stk.
                  </td>
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
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRemoveAdditionalCost(index)}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"
                          aria-label="Fjern"
                        >
                          <X size={14} />
                        </button>
                        <select
                          className="h-8 rounded-md border border-line bg-white pl-2 text-sm text-ink hover:border-gray-300 min-w-0 flex-1"
                          value={ac.id}
                          onChange={(e) =>
                            handleUpdateAdditionalCost(
                              index,
                              "id",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Velg tilleggskostnad</option>
                          {additionalCostOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({(item.price_per || 0).toFixed(0)}{" "}
                              kr)
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-1.5 text-right">
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
                        className="w-16 rounded-md border border-line bg-white px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-gray-300"
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
              <tr className="hover:bg-transparent!">
                <td colSpan={finished ? 6 : 5} className="py-1.5">
                  <button
                    onClick={handleAddAdditionalCost}
                    className="sk-btn sk-btn-ghost h-7 px-2 text-xs text-brand hover:text-brand-hover"
                  >
                    <Plus size={14} />
                    Legg til tilleggskostnader
                  </button>
                </td>
              </tr>
              <tr className="bg-gray-50/40 hover:bg-gray-50/40!">
                <td
                  colSpan={finished ? 5 : 4}
                  className="py-2! text-xs font-medium text-muted"
                >
                  Total installasjon påslag
                </td>
                <td className="whitespace-nowrap py-2! text-right text-xs font-semibold tabular-nums text-body">
                  {totalInstallationMarkup.toFixed(0)} kr
                </td>
              </tr>

              {/* ── PROVISJON ── */}
              <tr className="hover:bg-transparent!">
                <td
                  colSpan={finished ? 6 : 5}
                  className="border-b border-line! bg-gray-50/70 px-3! pb-1.5! pt-4! text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  <h2 className="font-sans! text-inherit">Soleklart Salgsprovisjon</h2>
                </td>
              </tr>
              {commissionAmount > 0 && (
                <tr>
                  <td className="py-1.5 text-ink">
                    Kommisjon ({displayCommissionPercentage.toFixed(0)}%)
                  </td>
                  <td className="py-1.5 text-right"></td>
                  <td className="py-1.5 text-right"></td>
                  <td className="py-1.5 text-right"></td>
                  <td className="whitespace-nowrap py-1.5 text-right">
                    <input
                      className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white font-semibold"
                      value={finalCommissionAmount.toFixed(0)}
                      onChange={(e) =>
                        handleCostChange("team_commission", e.target.value)
                      }
                    />
                    <span className="ml-0.5 text-xs text-muted">kr</span>
                  </td>
                  {finished && <td className="py-1.5"></td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ml-auto w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-4 py-2.5">
          <p className="sk-eyebrow">Sammendrag</p>
        </div>
        <dl className="flex flex-col text-sm tabular-nums">
          {/* ── TOTALER ── */}
          {leadCompany ? (
            <div className="flex items-baseline justify-between gap-4 bg-brand-soft px-4 py-3.5">
              <dt className="font-semibold text-ink">Total kostnad eks. mva</dt>
              <dd className="font-display text-lg font-semibold text-ink">
                {grandTotal.toFixed(0)} kr
              </dd>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="text-body">Total kostnad eks. mva</dt>
                <dd className="font-semibold text-ink">
                  {grandTotal.toFixed(0)} kr
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-gray-100 px-4 py-2.5">
                <dt className="font-semibold text-ink">
                  Total kostnad inkl. mva
                </dt>
                <dd className="font-display text-base font-semibold text-ink">
                  {(grandTotal * 1.25).toFixed(0)} kr
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-gray-100 px-4 py-2.5">
                <dt className="text-body">Enova støtte</dt>
                <dd className="font-semibold text-emerald-700">
                  {calculatedEnovaSupport.toFixed(0)} kr
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-blue-100 bg-brand-soft px-4 py-3.5">
                <dt className="text-sm font-semibold text-ink">
                  Total kostnad inkl. mva og Enova-støtte (privat)
                </dt>
                <dd className="shrink-0 font-display text-lg font-semibold text-brand">
                  {(grandTotal * 1.25 - calculatedEnovaSupport).toFixed(0)} kr
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
