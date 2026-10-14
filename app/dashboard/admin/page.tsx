"use client";

import { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { useRoles } from "@/context/RoleProvider";
import { getToken } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelStage {
  status: number;
  label: string;
  color: string;
  group: string;
  count: number;
  totalValue: number;
}

interface ColdCallerStat {
  name: string;
  assigned: number;
  called: number;
  converted: number;
  notInterested: number;
  noAnswer: number;
  conversionRate: number;
  other: number;
}

interface InboundSourceStat {
  source: string;
  label: string;
  assigned: number;
  lost: number;
  signed: number;
}

interface InstallerGroupStat {
  name: string;
  total: number;
  signed: number;
  value: number;
  signedRate?: number;
}

interface SegmentStats {
  totalLeads: number;
  activeLeads: number;
  qualifiedInPeriod: number;
  lostInPeriod: number;
  signedInPeriod: number;
  signedValue: number;
  pipelineValue: number;
}

interface InstallerBreakdownRow {
  key: string;
  label: string;
  stats: SegmentStats;
}

interface InstallerBreakdown {
  id: string;
  name: string;
  sources: InstallerBreakdownRow[];
  callers: { userId: string; name: string; stats: SegmentStats }[];
}

interface TimeSeries {
  period: string;
  count: number;
  value: number;
}

interface AdminStats {
  funnel: FunnelStage[];
  coldCallerStats: ColdCallerStat[];
  inboundStats: InboundSourceStat[];
  installerGroupStats: InstallerGroupStat[];
  coldInstallerGroupStats: InstallerGroupStat[];
  warmInstallerGroupStats: InstallerGroupStat[];
  installerBreakdown: InstallerBreakdown[];
  newLeadsOverTime: TimeSeries[];
  signedOverTime: TimeSeries[];
  sourceDistribution: {
    coldcall: number;
    google: number;
    facebook: number;
    organic: number;
  };
  valueBySource: {
    google: { signedValue: number; signedCount: number };
    facebook: { signedValue: number; signedCount: number };
    organic: { signedValue: number; signedCount: number };
    coldcall: { signedValue: number; signedCount: number };
  };
  summary: {
    totalLeads: number;
    activeLeads: number;
    newInPeriod: number;
    signedInPeriod: number;
    signedValueInPeriod: number;
    pipelineValue: number;
  };
  pipelineTracking: {
    lost: number;
    notInterested: number;
    newsletter: number;
    activePipeline: number;
    everSigned: number;
    signedNotMounted: number;
    commissionPaid: number;
    lostByDepth?: {
      coldcall: number;
      pipeline: number;
      dialog: number;
      offer: number;
      signed: number;
    };
  };
}

type DatePreset = "week" | "month" | "3months" | "6months" | "year" | "alltime";
type GroupBy = "day" | "week" | "month";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Denne uken", value: "week" },
  { label: "Siste 30 dager", value: "month" },
  { label: "Siste 3 mnd", value: "3months" },
  { label: "Siste 6 mnd", value: "6months" },
  { label: "I år", value: "year" },
  { label: "All time", value: "alltime" },
];

function getDateRange(preset: DatePreset): {
  from: string;
  to: string;
  groupBy: GroupBy;
} {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  switch (preset) {
    case "week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      return {
        from: monday.toISOString().split("T")[0],
        to: today,
        groupBy: "day",
      };
    }
    case "month": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return {
        from: d.toISOString().split("T")[0],
        to: today,
        groupBy: "day",
      };
    }
    case "3months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return {
        from: d.toISOString().split("T")[0],
        to: today,
        groupBy: "week",
      };
    }
    case "6months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return {
        from: d.toISOString().split("T")[0],
        to: today,
        groupBy: "week",
      };
    }
    case "year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return {
        from: first.toISOString().split("T")[0],
        to: today,
        groupBy: "month",
      };
    }
    case "alltime": {
      return { from: "2020-01-01", to: today, groupBy: "month" };
    }
  }
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

// Brand chart palette
const CHART = {
  blue: "#1869ff",
  orange: "#faa31a",
  green: "#10874b",
  gray: "#6b7889",
  grid: "#eef1f5",
  tick: "#6b7889",
};

const TOOLTIP_CLASS =
  "rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-pop";

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`sk-card p-6 ${className}`}>
      <h3 className="sk-section-title mb-5">{title}</h3>
      {children}
    </div>
  );
}

function StatPill({
  label,
  value,
  icon: Icon,
  chip = "bg-blue-50 text-blue-600",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  chip?: string;
}) {
  return (
    <div className="sk-card flex items-start gap-3.5 p-5 transition-shadow hover:shadow-pop">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${chip}`}
      >
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="sk-eyebrow truncate">{label}</span>
        <span className="font-display text-2xl font-semibold tabular-nums leading-none text-ink">
          {value}
        </span>
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-muted">{children}</p>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { teamId } = useTeam();
  const { teamRole } = useRoles();

  const [preset, setPreset] = useState<DatePreset>("month");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const currentYear = new Date().getFullYear();
  const [signedYear, setSignedYear] = useState(currentYear);
  const [signedYearData, setSignedYearData] = useState<
    { label: string; count: number; valueK: number }[]
  >([]);
  const [signedYearLoading, setSignedYearLoading] = useState(false);

  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const { from, to, groupBy: gb } = getDateRange(preset);
        const res = await fetch(
          `/api/admin/stats?teamId=${teamId}&from=${from}&to=${to}&groupBy=${gb}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) throw new Error("Failed");
        setStats(await res.json());
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError")
          console.error(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [teamId, preset]);

  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    setSignedYearLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/admin/stats?teamId=${teamId}&from=${signedYear}-01-01&to=${signedYear}-12-31&groupBy=month`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        const map = new Map<string, { count: number; value: number }>(
          (data.signedOverTime || []).map(
            (d: { period: string; count: number; value: number }) => [
              d.period.substring(0, 7),
              d,
            ],
          ),
        );
        setSignedYearData(
          Array.from({ length: 12 }, (_, i) => {
            const monthKey = `${signedYear}-${String(i + 1).padStart(2, "0")}`;
            const d = map.get(monthKey);
            return {
              label: MONTHS[i],
              count: d?.count ?? 0,
              valueK: d ? Math.round(d.value / 1000) : 0,
            };
          }),
        );
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError")
          console.error(err);
      } finally {
        setSignedYearLoading(false);
      }
    })();
    return () => controller.abort();
  }, [teamId, signedYear]);

  if (teamRole && teamRole !== "admin") {
    return (
      <div className="sk-page">
        <div className="sk-empty">
          <ShieldAlert size={22} className="text-gray-400" />
          Kun tilgjengelig for administratorer.
        </div>
      </div>
    );
  }

  const s = stats?.summary;

  // Source distribution for pie (period-filtered)
  const pieData = [
    {
      name: "Cold calling",
      value: stats?.sourceDistribution?.coldcall ?? 0,
      color: CHART.orange,
    },
    {
      name: "Google Ads",
      value: stats?.sourceDistribution?.google ?? 0,
      color: CHART.blue,
    },
    {
      name: "Facebook Ads",
      value: stats?.sourceDistribution?.facebook ?? 0,
      color: "#a3c4fb",
    },
    {
      name: "Organic",
      value: stats?.sourceDistribution?.organic ?? 0,
      color: CHART.green,
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="sk-page space-y-6">
      {/* Header */}
      <div className="sk-page-header !mb-0">
        <div>
          <p className="sk-eyebrow mb-1">Admin</p>
          <h1 className="sk-page-title">Admin Dashboard</h1>
          <p className="sk-page-subtitle">Pipeline · Flaskehalser · Ytelse</p>
        </div>
        <div className="sk-tabs flex-wrap">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`sk-tab !text-xs ${
                preset === p.value ? "sk-tab-active" : ""
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin text-brand" />
          Laster...
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Summary pills */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatPill
              label="Totalt leads"
              value={s?.totalLeads ?? 0}
              icon={Users}
              chip="bg-gray-100 text-gray-600"
            />
            {/* TODO */}
            <StatPill
              label="Kvalifiserte leads"
              value={s?.activeLeads ?? 0}
              icon={Target}
              chip="bg-blue-50 text-blue-600"
            />

            <StatPill
              label="Pipeline-verdi"
              value={`${formatCurrency(s?.pipelineValue ?? 0)} kr`}
              icon={TrendingUp}
              chip="bg-orange-50 text-orange-600"
            />
            <StatPill
              label="Signert (periode)"
              value={s?.signedInPeriod ?? 0}
              icon={CheckCircle2}
              chip="bg-emerald-50 text-emerald-700"
            />
            <StatPill
              label="Signert verdi"
              value={`${formatCurrency(s?.signedValueInPeriod ?? 0)} kr`}
              icon={Wallet}
              chip="bg-emerald-50 text-emerald-700"
            />
          </div>

          {/* Row 4: Per-installer breakdown grid */}
          {(stats.installerBreakdown || []).filter(
            (g) => g.name.toLowerCase() !== "testelektro",
          ).length > 0 && (
            <div className="space-y-3">
              <h2 className="sk-section-title">Breakdown per installatør</h2>
              {stats.installerBreakdown
                .filter((g) => g.name.toLowerCase() !== "testelektro")
                .map((group) => {
                  const isOpen = expandedGroups.has(group.id);

                  // Totals = inbound sources + individual callers.
                  // The "coldcall" source bucket is NOT summed here — callers
                  // are the per-person breakdown of that same bucket, so including
                  // both would double-count every cold-call lead.
                  const inboundSources = group.sources.filter(
                    (r) => r.key !== "coldcall",
                  );
                  const expandedTotals: SegmentStats = [
                    ...inboundSources.map((r) => r.stats),
                    ...group.callers.map((c) => c.stats),
                  ].reduce(
                    (acc, s) => ({
                      totalLeads: acc.totalLeads + s.totalLeads,
                      activeLeads: acc.activeLeads + s.activeLeads,
                      qualifiedInPeriod:
                        acc.qualifiedInPeriod + s.qualifiedInPeriod,
                      lostInPeriod: acc.lostInPeriod + s.lostInPeriod,
                      signedInPeriod: acc.signedInPeriod + s.signedInPeriod,
                      signedValue: acc.signedValue + s.signedValue,
                      pipelineValue: acc.pipelineValue + s.pipelineValue,
                    }),
                    {
                      totalLeads: 0,
                      activeLeads: 0,
                      qualifiedInPeriod: 0,
                      lostInPeriod: 0,
                      signedInPeriod: 0,
                      signedValue: 0,
                      pipelineValue: 0,
                    },
                  );

                  return (
                    <div key={group.id} className="sk-card overflow-hidden">
                      {/* Clickable header */}
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="flex w-full items-center justify-between gap-3 border-b border-line px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="size-2 rounded-full bg-brand" />
                          <span className="font-display text-sm font-semibold text-ink">
                            {group.name}
                          </span>
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-muted transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <div className="overflow-x-auto">
                        <table className="sk-table">
                          <thead>
                            <tr>
                              <th className="w-48 !pl-5">Segment</th>
                              <th className="!text-right">
                                Kvalifiserte leads
                              </th>
                              <th className="!text-right">Tapt</th>
                              <th className="!text-right">Signert</th>
                              <th className="!text-right">Sign. verdi</th>
                              <th className="!pr-5 !text-right">Pipeline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!isOpen && (
                              <tr>
                                <td className="!pl-5 font-semibold !text-ink">
                                  Totalt
                                </td>
                                <td className="text-right font-semibold tabular-nums !text-blue-600">
                                  {expandedTotals.qualifiedInPeriod}
                                </td>
                                <td className="text-right tabular-nums !text-red-600">
                                  {expandedTotals.lostInPeriod}
                                </td>
                                <td className="text-right font-semibold tabular-nums !text-emerald-700">
                                  {expandedTotals.signedInPeriod}
                                </td>
                                <td className="text-right font-semibold tabular-nums !text-ink">
                                  {formatCurrency(expandedTotals.signedValue)}{" "}
                                  kr
                                </td>
                                <td className="!pr-5 text-right font-semibold tabular-nums !text-ink">
                                  {formatCurrency(expandedTotals.pipelineValue)}{" "}
                                  kr
                                </td>
                              </tr>
                            )}
                            {isOpen && (
                              <>
                                {/* Inbound sources (google / facebook / organic) */}
                                <tr className="hover:!bg-transparent">
                                  <td
                                    colSpan={6}
                                    className="!bg-gray-50/70 !py-1.5 !pl-5 sk-eyebrow"
                                  >
                                    Inbound kilder
                                  </td>
                                </tr>
                                {inboundSources.map((row) => (
                                  <tr key={row.key}>
                                    <td className="!pl-5 font-medium !text-ink">
                                      {row.label}
                                    </td>
                                    <td className="text-right font-semibold tabular-nums !text-blue-600">
                                      {row.stats.qualifiedInPeriod}
                                    </td>
                                    <td className="text-right tabular-nums !text-red-600">
                                      {row.stats.lostInPeriod}
                                    </td>
                                    <td className="text-right font-semibold tabular-nums !text-emerald-700">
                                      {row.stats.signedInPeriod}
                                    </td>
                                    <td className="text-right tabular-nums">
                                      {formatCurrency(row.stats.signedValue)} kr
                                    </td>
                                    <td className="!pr-5 text-right tabular-nums">
                                      {formatCurrency(row.stats.pipelineValue)}{" "}
                                      kr
                                    </td>
                                  </tr>
                                ))}
                                {/* Cold calling — one row per caller (breakdown of the coldcall bucket) */}
                                {group.callers.length > 0 && (
                                  <>
                                    <tr className="hover:!bg-transparent">
                                      <td
                                        colSpan={6}
                                        className="!bg-gray-50/70 !py-1.5 !pl-5 sk-eyebrow"
                                      >
                                        Cold calling — per innhenter
                                      </td>
                                    </tr>
                                    {group.callers.map((caller) => (
                                      <tr key={caller.userId}>
                                        <td className="!pl-5 font-medium !text-ink">
                                          {caller.name}
                                        </td>
                                        <td className="text-right font-semibold tabular-nums !text-blue-600">
                                          {caller.stats.qualifiedInPeriod}
                                        </td>
                                        <td className="text-right tabular-nums !text-red-600">
                                          {caller.stats.lostInPeriod}
                                        </td>
                                        <td className="text-right font-semibold tabular-nums !text-emerald-700">
                                          {caller.stats.signedInPeriod}
                                        </td>
                                        <td className="text-right tabular-nums">
                                          {formatCurrency(
                                            caller.stats.signedValue,
                                          )}{" "}
                                          kr
                                        </td>
                                        <td className="!pr-5 text-right tabular-nums">
                                          {formatCurrency(
                                            caller.stats.pipelineValue,
                                          )}{" "}
                                          kr
                                        </td>
                                      </tr>
                                    ))}
                                  </>
                                )}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Pipeline tracking A–E */}
          {stats.pipelineTracking &&
            (() => {
              const pt = stats.pipelineTracking;
              return (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {/* A: Tapte */}
                  <div className="sk-card relative flex flex-col gap-1.5 overflow-hidden p-5">
                    <span className="absolute inset-x-0 top-0 h-1 bg-red-500" />
                    <span className="sk-badge sk-badge-danger self-start">
                      A · Tapte
                    </span>
                    <span className="font-display text-3xl font-semibold tabular-nums text-ink">
                      {pt.lost}
                    </span>
                    <span className="text-xs leading-relaxed text-muted">
                      {pt.notInterested} ikke interessert
                      <br />
                      {pt.newsletter} nyhetsbrev
                    </span>
                    {pt.lostByDepth && (
                      <div className="mt-2 flex flex-col gap-1 border-t border-line pt-3">
                        <span className="sk-eyebrow mb-0.5">
                          Hvor langt kom de?
                        </span>
                        {pt.lostByDepth.signed > 0 && (
                          <span className="text-xs font-medium text-red-600">
                            {pt.lostByDepth.signed} var signert
                          </span>
                        )}
                        {pt.lostByDepth.offer > 0 && (
                          <span className="text-xs text-body">
                            {pt.lostByDepth.offer} hadde tilbud
                          </span>
                        )}
                        {pt.lostByDepth.dialog > 0 && (
                          <span className="text-xs text-body">
                            {pt.lostByDepth.dialog} i dialog
                          </span>
                        )}
                        {pt.lostByDepth.pipeline > 0 && (
                          <span className="text-xs text-muted">
                            {pt.lostByDepth.pipeline} nådde pipeline
                          </span>
                        )}
                        {pt.lostByDepth.coldcall > 0 && (
                          <span className="text-xs text-muted">
                            {pt.lostByDepth.coldcall} aldri i pipeline
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* B: Aktive i pipeline */}
                  <div className="sk-card relative flex flex-col gap-1.5 overflow-hidden p-5">
                    <span className="absolute inset-x-0 top-0 h-1 bg-brand" />
                    <span className="sk-badge sk-badge-brand self-start">
                      B · Aktive
                    </span>
                    <span className="font-display text-3xl font-semibold tabular-nums text-ink">
                      {pt.activePipeline}
                    </span>
                    <span className="text-xs text-muted">
                      Dialog → venter på signering
                    </span>
                  </div>

                  {/* C: Signerte */}
                  <div className="sk-card relative flex flex-col gap-1.5 overflow-hidden p-5">
                    <span className="absolute inset-x-0 top-0 h-1 bg-emerald-600" />
                    <span className="sk-badge sk-badge-success self-start">
                      C · Signert
                    </span>
                    <span className="font-display text-3xl font-semibold tabular-nums text-ink">
                      {pt.everSigned}
                    </span>
                    <span className="text-xs text-muted">
                      Har hatt signert avtale
                    </span>
                  </div>

                  {/* D: Signert men ikke montert */}
                  <div className="sk-card relative flex flex-col gap-1.5 overflow-hidden p-5">
                    <span className="absolute inset-x-0 top-0 h-1 bg-accent" />
                    <span className="sk-badge sk-badge-warning self-start">
                      D · Ikke montert
                    </span>
                    <span className="font-display text-3xl font-semibold tabular-nums text-ink">
                      {pt.signedNotMounted}
                    </span>
                    <span className="text-xs text-muted">
                      Signert, aldri ferdigmontert
                    </span>
                  </div>

                  {/* E: Kommisjon utbetalt */}
                  <div className="sk-card relative flex flex-col gap-1.5 overflow-hidden p-5">
                    <span className="absolute inset-x-0 top-0 h-1 bg-emerald-800" />
                    <span className="sk-badge sk-badge-success self-start">
                      E · Kommisjon
                    </span>
                    <span className="font-display text-3xl font-semibold tabular-nums text-ink">
                      {pt.commissionPaid}
                    </span>
                    <span className="text-xs text-muted">
                      Kommisjon utbetalt
                    </span>
                  </div>
                </div>
              );
            })()}

          {/* Row 1: Cold calling distribution + source pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cold caller distribution donut */}
            {(() => {
              const CALLER_COLORS = [
                CHART.blue,
                CHART.orange,
                CHART.green,
                CHART.gray,
                "#a3c4fb",
                "#fdd08a",
                "#0e2c63",
                "#7cc4a0",
                "#c8d1dc",
                "#b96f00",
              ];
              const callerPieData = stats.coldCallerStats.map((c, i) => ({
                name: c.name,
                value: c.assigned,
                color: CALLER_COLORS[i % CALLER_COLORS.length],
              }));
              const callerTotal = callerPieData.reduce(
                (s, x) => s + x.value,
                0,
              );
              return (
                <Card
                  title="Status – Cold calling fordeling"
                  className="lg:col-span-2"
                >
                  {callerPieData.length === 0 || callerTotal === 0 ? (
                    <EmptyNote>Ingen cold calling data i perioden.</EmptyNote>
                  ) : (
                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={callerPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={2}
                            cornerRadius={4}
                            dataKey="value"
                            labelLine={false}
                          >
                            {callerPieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className={TOOLTIP_CLASS}>
                                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                                    <span
                                      className="size-2 rounded-full"
                                      style={{ background: d.color }}
                                    />
                                    {d.name}
                                  </p>
                                  <p className="mt-0.5 tabular-nums text-muted">
                                    {d.value} leads (
                                    {Math.round((d.value / callerTotal) * 100)}
                                    %)
                                  </p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex min-w-[200px] flex-col gap-1">
                        {callerPieData
                          .slice()
                          .sort((a, b) => b.value - a.value)
                          .map((d) => (
                            <div
                              key={d.name}
                              className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-2.5 shrink-0 rounded-full"
                                  style={{ background: d.color }}
                                />
                                <span className="text-body">{d.name}</span>
                              </div>
                              <span className="font-semibold tabular-nums text-ink">
                                {d.value}{" "}
                                <span className="font-normal text-muted">
                                  ({Math.round((d.value / callerTotal) * 100)}%)
                                </span>
                              </span>
                            </div>
                          ))}
                        <p className="mt-2 border-t border-line px-2 pt-2 text-xs text-muted">
                          Totalt:{" "}
                          <span className="font-semibold tabular-nums text-ink">
                            {callerTotal}
                          </span>{" "}
                          leads
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* Source distribution pie */}
            <Card title="Status-Pipeline fordeling">
              {pieData.length === 0 ? (
                <EmptyNote>Ingen leads.</EmptyNote>
              ) : (
                <div className="flex flex-col gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={2}
                        cornerRadius={4}
                        dataKey="value"
                        labelLine={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          const total = pieData.reduce(
                            (s, x) => s + x.value,
                            0,
                          );
                          return (
                            <div className={TOOLTIP_CLASS}>
                              <p className="flex items-center gap-1.5 font-semibold text-ink">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ background: d.color }}
                                />
                                {d.name}
                              </p>
                              <p className="mt-0.5 tabular-nums text-muted">
                                {d.value} leads (
                                {Math.round((d.value / total) * 100)}%)
                              </p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex flex-col gap-1">
                    {pieData.map((d) => {
                      const total = pieData.reduce((s, x) => s + x.value, 0);
                      return (
                        <div
                          key={d.name}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ background: d.color }}
                            />
                            <span className="text-body">{d.name}</span>
                          </div>
                          <span className="font-semibold tabular-nums text-ink">
                            {d.value}{" "}
                            <span className="font-normal text-muted">
                              ({Math.round((d.value / total) * 100)}%)
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Row 2: Cold-caller leaderboard + Bottlenecks + Installer groups */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Cold-caller leaderboard */}
            <Card title="Cold-caller ytelse">
              {stats.coldCallerStats.length === 0 ? (
                <EmptyNote>Ingen data.</EmptyNote>
              ) : (
                <div className="flex flex-col gap-5">
                  {stats.coldCallerStats.map((caller, i) => (
                    <div
                      key={caller.name + i}
                      className="flex flex-col gap-2"
                    >
                      {/* Name row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                              i === 0
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-muted"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="max-w-[120px] truncate text-sm font-semibold text-ink">
                            {caller.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="tabular-nums text-muted">
                            {caller.called} totalt
                          </span>
                          <span
                            className={`sk-badge tabular-nums ${
                              caller.conversionRate >= 20
                                ? "sk-badge-success"
                                : caller.conversionRate >= 10
                                  ? "sk-badge-warning"
                                  : "sk-badge-danger"
                            }`}
                          >
                            {caller.conversionRate}%
                          </span>
                        </div>
                      </div>
                      {/* Progress bar: converted / not interested / no answer / not called */}
                      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{
                            width: `${(caller.converted / caller.assigned) * 100}%`,
                          }}
                          title={`${caller.converted} konvertert`}
                        />
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{
                            width: `${(caller.notInterested / caller.assigned) * 100}%`,
                          }}
                          title={`${caller.notInterested} ikke interessert`}
                        />
                        <div
                          className="h-full rounded-full bg-gray-300"
                          style={{
                            width: `${(caller.other / caller.assigned) * 100}%`,
                          }}
                          title={`${caller.other} annet`}
                        />
                      </div>
                      {/* Results row */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-600" />
                          {caller.converted} konvertert
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-red-400" />
                          {caller.notInterested} ikke int.
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-accent" />
                          {caller.noAnswer} ingen svar
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-gray-300" />
                          {caller.other} annet
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-line pt-3 text-xs text-muted">
                    % = konvertert av tildelte nummer
                  </p>
                </div>
              )}
            </Card>

            {/* Cold leads per installer group, ranked by signed rate */}
            <Card title="Kalde leads — per installatørgruppe">
              {(stats.coldInstallerGroupStats ?? []).length === 0 ? (
                <EmptyNote>Ingen data.</EmptyNote>
              ) : (
                <div className="flex flex-col gap-4">
                  {stats.coldInstallerGroupStats.map((g) => {
                    const rate = g.signedRate ?? 0;
                    const maxRate = Math.max(
                      ...stats.coldInstallerGroupStats.map(
                        (x) => x.signedRate ?? 0,
                      ),
                      1,
                    );
                    return (
                      <div key={g.name} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="max-w-[140px] truncate text-sm font-semibold text-ink">
                            {g.name}
                          </span>
                          <span className="sk-badge sk-badge-success tabular-nums">
                            {rate}% signert
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-brand transition-all duration-500"
                            style={{ width: `${(rate / maxRate) * 100}%` }}
                          />
                        </div>
                        <div className="flex gap-3 text-xs tabular-nums text-muted">
                          <span>
                            {g.total} leads · {g.signed} signert
                          </span>
                          {/* {g.value > 0 && (
                            <span>{formatCurrency(g.value)} kr</span>
                          )} */}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Warm leads per installer group, ranked by signed rate */}
            <Card title="Varme leads — per installatørgruppe">
              {(stats.warmInstallerGroupStats ?? []).length === 0 ? (
                <EmptyNote>Ingen data.</EmptyNote>
              ) : (
                <div className="flex flex-col gap-4">
                  {stats.warmInstallerGroupStats.map((g) => {
                    const rate = g.signedRate ?? 0;
                    const maxRate = Math.max(
                      ...stats.warmInstallerGroupStats.map(
                        (x) => x.signedRate ?? 0,
                      ),
                      1,
                    );
                    return (
                      <div key={g.name} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="max-w-[140px] truncate text-sm font-semibold text-ink">
                            {g.name}
                          </span>
                          <span className="sk-badge sk-badge-success tabular-nums">
                            {rate}% signert
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-brand transition-all duration-500"
                            style={{ width: `${(rate / maxRate) * 100}%` }}
                          />
                        </div>
                        <div className="flex gap-3 text-xs tabular-nums text-muted">
                          <span>
                            {g.total} leads · {g.signed} signert
                          </span>
                          {/* {g.value > 0 && (
                            <span>{formatCurrency(g.value)} kr</span>
                          )} */}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Row 3: Inbound / warm leads */}
          <Card title="Varme leads — trafikkkilder">
            {stats.inboundStats.every((s) => s.assigned === 0) ? (
              <EmptyNote>Ingen inbound leads i perioden.</EmptyNote>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {stats.inboundStats.map((src) => (
                  <div
                    key={src.source}
                    className="flex flex-col gap-2.5 rounded-xl border border-line bg-gray-50/60 p-4"
                  >
                    {/* Source header */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">
                        {src.label}
                      </span>
                      <span className="sk-badge sk-badge-neutral tabular-nums">
                        {src.assigned} totalt
                      </span>
                    </div>
                    {/* Progress bar: signert (grønn) / tapt (rød) */}
                    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-gray-200/70">
                      {src.assigned > 0 && (
                        <>
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{
                              width: `${(src.signed / src.assigned) * 100}%`,
                            }}
                            title={`${src.signed} signert`}
                          />
                          <div
                            className="h-full rounded-full bg-red-400"
                            style={{
                              width: `${(src.lost / src.assigned) * 100}%`,
                            }}
                            title={`${src.lost} tapt`}
                          />
                        </>
                      )}
                    </div>
                    {/* Results */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
                      <span className="text-body">{src.assigned} antall</span>
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-red-400" />
                        {src.lost} tapt
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-600" />
                        {src.signed} signert
                      </span>
                    </div>
                    {src.assigned === 0 && (
                      <p className="text-xs text-muted">Ingen leads</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted">
              Tapt = Ikke interessert + Nyhetsbrev · Kilde bestemt av
              fbclid/gclid i merknaden
            </p>
          </Card>

          {/* Signert verdi per trafikkilde */}
          {stats.valueBySource &&
            (() => {
              const SOURCE_DEF = [
                {
                  key: "facebook" as const,
                  label: "Facebook",
                  color: "bg-[#a3c4fb]",
                  bar: "bg-[#a3c4fb]",
                },
                {
                  key: "google" as const,
                  label: "Google",
                  color: "bg-brand",
                  bar: "bg-brand",
                },
                {
                  key: "organic" as const,
                  label: "Organic",
                  color: "bg-[#10874b]",
                  bar: "bg-[#10874b]",
                },
                {
                  key: "coldcall" as const,
                  label: "Cold calling",
                  color: "bg-accent",
                  bar: "bg-accent",
                },
              ];

              const vbs = stats.valueBySource;
              const totalValue = SOURCE_DEF.reduce(
                (sum, s) => sum + vbs[s.key].signedValue,
                0,
              );
              const totalCount = SOURCE_DEF.reduce(
                (sum, s) => sum + vbs[s.key].signedCount,
                0,
              );
              const maxValue = Math.max(
                ...SOURCE_DEF.map((s) => vbs[s.key].signedValue),
                1,
              );

              // Per-installer rows: each installer's signed value per source
              const installerRows = (stats.installerBreakdown || [])
                .filter((g) => g.name.toLowerCase() !== "testelektro")
                .map((group) => {
                  const bySource: Record<
                    string,
                    { value: number; count: number }
                  > = {};
                  group.sources.forEach((src) => {
                    bySource[src.key] = {
                      value: src.stats.signedValue,
                      count: src.stats.signedInPeriod,
                    };
                  });
                  const rowTotal = SOURCE_DEF.reduce(
                    (sum, s) => sum + (bySource[s.key]?.value ?? 0),
                    0,
                  );
                  const rowCount = SOURCE_DEF.reduce(
                    (sum, s) => sum + (bySource[s.key]?.count ?? 0),
                    0,
                  );
                  return { group, bySource, rowTotal, rowCount };
                })
                .sort((a, b) => b.rowTotal - a.rowTotal);

              if (
                totalCount === 0 &&
                installerRows.every((r) => r.rowCount === 0)
              )
                return null;

              return (
                <Card title="Signert verdi per trafikkilde">
                  {/* Total summary pills */}
                  <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {SOURCE_DEF.map((s) => {
                      const d = vbs[s.key];
                      const pct =
                        totalValue > 0
                          ? Math.round((d.signedValue / totalValue) * 100)
                          : 0;
                      return (
                        <div
                          key={s.key}
                          className="flex flex-col gap-1.5 rounded-xl border border-line bg-gray-50/60 p-4"
                        >
                          <span className="flex items-center gap-1.5 sk-eyebrow">
                            <span
                              className={`size-2 rounded-full ${s.color}`}
                            />
                            {s.label}
                          </span>
                          <span className="font-display text-xl font-semibold tabular-nums text-ink">
                            {formatCurrency(d.signedValue)} kr
                          </span>
                          <span className="text-xs tabular-nums text-muted">
                            {d.signedCount} salg · {pct}% av total
                          </span>
                          {/* Value bar relative to max source */}
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200/70">
                            <div
                              className={`h-full rounded-full ${s.bar} transition-all duration-500`}
                              style={{
                                width: `${(d.signedValue / maxValue) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total row */}
                  <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3 text-sm">
                    <span className="font-semibold text-body">
                      Totalt alle kilder
                    </span>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatCurrency(totalValue)} kr · {totalCount} salg
                    </span>
                  </div>

                  {/* Per-installer table */}
                  {installerRows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="sk-table">
                        <thead>
                          <tr>
                            <th className="w-48 !pl-4">Installatør</th>
                            {SOURCE_DEF.map((s) => (
                              <th key={s.key} className="!text-right">
                                {s.label}
                              </th>
                            ))}
                            <th className="!pr-4 !text-right">Totalt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {installerRows.map(
                            ({ group, bySource, rowTotal, rowCount }) => (
                              <tr key={group.id}>
                                <td className="max-w-[140px] truncate !pl-4 font-medium !text-ink">
                                  {group.name}
                                </td>
                                {SOURCE_DEF.map((s) => {
                                  const d = bySource[s.key];
                                  return (
                                    <td
                                      key={s.key}
                                      className="text-right tabular-nums"
                                    >
                                      {d && d.value > 0 ? (
                                        <>
                                          <span className="font-medium text-ink">
                                            {formatCurrency(d.value)} kr
                                          </span>
                                          <span className="ml-1 text-muted">
                                            ({d.count})
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="!pr-4 text-right font-semibold tabular-nums !text-ink">
                                  {rowTotal > 0 ? (
                                    <>
                                      {formatCurrency(rowTotal)} kr
                                      <span className="ml-1 font-normal text-muted">
                                        ({rowCount})
                                      </span>
                                    </>
                                  ) : (
                                    <span className="font-normal text-gray-300">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-4 text-xs text-muted">
                    Kilde bestemt av fbclid/gclid i merknad · Periodefiltrert
                    (samme som tidsvalg over)
                  </p>
                </Card>
              );
            })()}

          {/* Signerte avtaler — årsvisning */}
          {(() => {
            const totalCount = signedYearData.reduce(
              (sum, d) => sum + d.count,
              0,
            );
            const totalValueK = signedYearData.reduce(
              (sum, d) => sum + d.valueK,
              0,
            );
            const years = Array.from(
              { length: 5 },
              (_, i) => currentYear - 2 + i,
            );
            return (
              <Card title="Signerte avtaler per måned">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="sk-tabs">
                    {years.map((y) => (
                      <button
                        key={y}
                        onClick={() => setSignedYear(y)}
                        disabled={signedYearLoading}
                        className={`sk-tab !text-xs tabular-nums disabled:cursor-not-allowed disabled:opacity-50 ${
                          signedYear === y ? "sk-tab-active" : ""
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-5 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-body">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: CHART.blue }}
                      />
                      <span className="tabular-nums">
                        {totalCount} salg totalt
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-body">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: CHART.orange }}
                      />
                      <span className="tabular-nums">
                        {formatCurrency(totalValueK * 1000)} kr totalt
                      </span>
                    </span>
                  </div>
                </div>
                <div className="relative">
                  {signedYearLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-white/70 backdrop-blur-[1px]">
                      <Loader2 size={16} className="animate-spin text-brand" />
                      <span className="text-sm text-muted">Laster...</span>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={signedYearData}
                      margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
                      barGap={4}
                      barCategoryGap="22%"
                    >
                      <CartesianGrid
                        stroke={CHART.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: CHART.tick }}
                        axisLine={false}
                        tickLine={false}
                        dy={6}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: CHART.tick }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: CHART.tick }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}k`}
                      />
                      <Tooltip
                        cursor={{ fill: "#f1f6ff", radius: 6 }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className={TOOLTIP_CLASS}>
                              <p className="mb-1.5 font-semibold text-ink">
                                {label}
                              </p>
                              <p className="flex items-center gap-1.5 tabular-nums text-body">
                                <span
                                  className="size-2 rounded-sm"
                                  style={{ background: CHART.blue }}
                                />
                                Avtaler:{" "}
                                <span className="font-semibold text-ink">
                                  {payload[0]?.value}
                                </span>
                              </p>
                              {(payload[1]?.value as number) > 0 && (
                                <p className="mt-0.5 flex items-center gap-1.5 tabular-nums text-body">
                                  <span
                                    className="size-2 rounded-sm"
                                    style={{ background: CHART.orange }}
                                  />
                                  Verdi:{" "}
                                  <span className="font-semibold text-ink">
                                    {payload[1]?.value}k kr
                                  </span>
                                </p>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="count"
                        name="Signerte"
                        fill={CHART.blue}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={22}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="valueK"
                        name="Verdi (k)"
                        fill={CHART.orange}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:max-w-md">
                  <div className="flex flex-col gap-1">
                    <span className="sk-eyebrow">Totalt antall salg</span>
                    <span className="font-display text-2xl font-semibold tabular-nums text-ink">
                      {totalCount}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="sk-eyebrow">Total verdi</span>
                    <span className="font-display text-2xl font-semibold tabular-nums text-ink">
                      {formatCurrency(totalValueK * 1000)} kr
                    </span>
                  </div>
                </div>
              </Card>
            );
          })()}
        </>
      )}
    </div>
  );
}
