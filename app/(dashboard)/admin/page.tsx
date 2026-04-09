"use client";

import { useCallback, useEffect, useState } from "react";
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
  total: number;
  reachedPipeline: number;
  signed: number;
  signedValue: number;
  conversionRate: number;
}

interface InstallerGroupStat {
  name: string;
  total: number;
  signed: number;
  value: number;
}

interface TimeSeries {
  period: string;
  count: number;
  value: number;
}

interface AdminStats {
  funnel: FunnelStage[];
  coldCallerStats: ColdCallerStat[];
  installerGroupStats: InstallerGroupStat[];
  newLeadsOverTime: TimeSeries[];
  signedOverTime: TimeSeries[];
  summary: {
    totalLeads: number;
    activeLeads: number;
    newInPeriod: number;
    signedInPeriod: number;
    signedValueInPeriod: number;
    pipelineValue: number;
  };
}

type DatePreset = "week" | "month" | "3months" | "6months" | "year";
type GroupBy = "day" | "week" | "month";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Denne uken", value: "week" },
  { label: "Denne mnd", value: "month" },
  { label: "Siste 3 mnd", value: "3months" },
  { label: "Siste 6 mnd", value: "6months" },
  { label: "I år", value: "year" },
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
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from: first.toISOString().split("T")[0],
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

function formatPeriodLabel(period: string, groupBy: GroupBy): string {
  const d = new Date(period);
  if (groupBy === "month") return MONTHS[d.getMonth()];
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatPill({
  label,
  value,
  color = "bg-gray-100 text-gray-700",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className={`rounded-lg px-4 py-3 flex flex-col gap-0.5 ${color}`}>
      <span className="text-xs font-medium opacity-70">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

// Custom tooltip
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number | string; name: string; color?: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-[200px]">
      <p className="font-semibold text-gray-800 mb-1 truncate">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#374151" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { teamId } = useTeam();
  const { teamRole } = useRoles();

  const [preset, setPreset] = useState<DatePreset>("month");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("day");

  const fetchStats = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const { from, to, groupBy: gb } = getDateRange(preset);
      setGroupBy(gb);
      const res = await fetch(
        `/api/admin/stats?teamId=${teamId}&from=${from}&to=${to}&groupBy=${gb}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed");
      setStats(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teamId, preset]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (teamRole && teamRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Kun tilgjengelig for administratorer.
      </div>
    );
  }

  const s = stats?.summary;

  // Active funnel stages only (exclude dead + empty)
  const activeFunnel = (stats?.funnel || []).filter(
    (f) => f.group !== "dead" && f.count > 0,
  );

  // Status distribution for pie (group all active statuses)
  const pieData = [
    {
      name: "Cold calling",
      value: (stats?.funnel || [])
        .filter((f) => f.group === "cold" && f.count > 0)
        .reduce((s, f) => s + f.count, 0),
      color: "#FFDB59",
    },
    {
      name: "Pipeline",
      value: (stats?.funnel || [])
        .filter((f) => f.group === "pipeline" && f.count > 0)
        .reduce((s, f) => s + f.count, 0),
      color: "#DAFFB7",
    },
    {
      name: "Closing",
      value: (stats?.funnel || [])
        .filter((f) => f.group === "closing" && f.count > 0)
        .reduce((s, f) => s + f.count, 0),
      color: "#6DFF68",
    },
    {
      name: "Ikke interessert",
      value: (stats?.funnel || [])
        .filter((f) => f.group === "dead" && f.count > 0)
        .reduce((s, f) => s + f.count, 0),
      color: "#d1d5db",
    },
  ].filter((d) => d.value > 0);

  // Bottlenecks: pipeline + closing stages sorted by lead count (biggest pile-up first)
  const bottlenecks = activeFunnel
    .filter((f) => f.group === "pipeline" || f.group === "closing")
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  // Time series with labels
  const newLeadsChart = (stats?.newLeadsOverTime || []).map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period, groupBy),
  }));
  const signedChart = (stats?.signedOverTime || []).map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period, groupBy),
    valueK: Math.round(d.value / 1000),
  }));

  // Cold caller max for bar scaling
  const maxColdCallerTotal = Math.max(
    ...(stats?.coldCallerStats || []).map((c) => c.total),
    1,
  );

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Pipeline · Flaskehalser · Ytelse
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                preset === p.value
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          Laster...
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Summary pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatPill
              label="Totalt leads"
              value={s?.totalLeads ?? 0}
              color="bg-gray-100 text-gray-800"
            />
            <StatPill
              label="Aktive leads"
              value={s?.activeLeads ?? 0}
              color="bg-blue-50 text-blue-800"
            />
            <StatPill
              label={`Nye (${DATE_PRESETS.find((p) => p.value === preset)?.label})`}
              value={s?.newInPeriod ?? 0}
              color="bg-indigo-50 text-indigo-800"
            />
            <StatPill
              label="Pipeline-verdi"
              value={`${formatCurrency(s?.pipelineValue ?? 0)} kr`}
              color="bg-violet-50 text-violet-800"
            />
            <StatPill
              label="Signert (periode)"
              value={s?.signedInPeriod ?? 0}
              color="bg-emerald-50 text-emerald-800"
            />
            <StatPill
              label="Signert verdi"
              value={`${formatCurrency(s?.signedValueInPeriod ?? 0)} kr`}
              color="bg-green-50 text-green-800"
            />
          </div>

          {/* Row 1: Pipeline funnel + status pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Funnel bar chart — shows WHERE leads pile up */}
            <Card title="Pipeline — nåtilstand" className="lg:col-span-2">
              {activeFunnel.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Ingen leads.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={activeFunnel}
                    layout="vertical"
                    margin={{ top: 0, right: 48, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={160}
                      tick={{ fontSize: 11, fill: "#374151" }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as FunnelStage;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                            <p className="font-semibold text-gray-800 mb-1">
                              {d.label}
                            </p>
                            <p className="text-gray-600">Leads: {d.count}</p>
                            {d.totalValue > 0 && (
                              <p className="text-gray-600">
                                Verdi: {formatCurrency(d.totalValue)} kr
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {activeFunnel.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Status distribution pie */}
            <Card title="Status-fordeling">
              {pieData.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Ingen leads.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        labelLine={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
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
                            <div className="bg-white border border-gray-200 rounded-lg shadow p-2 text-xs">
                              <p className="font-semibold">{d.name}</p>
                              <p>
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
                  <div className="flex flex-col gap-1.5">
                    {pieData.map((d) => {
                      const total = pieData.reduce((s, x) => s + x.value, 0);
                      return (
                        <div
                          key={d.name}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                              style={{ background: d.color }}
                            />
                            <span className="text-gray-600">{d.name}</span>
                          </div>
                          <span className="font-medium text-gray-800">
                            {d.value} ({Math.round((d.value / total) * 100)}%)
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cold-caller leaderboard */}
            <Card title="Cold-caller ytelse">
              {stats.coldCallerStats.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  Ingen data.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.coldCallerStats.map((caller, i) => (
                    <div
                      key={caller.name + i}
                      className="flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-300 w-4">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate max-w-[120px]">
                            {caller.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400">
                            {caller.total} leads
                          </span>
                          <span
                            className={`font-semibold px-1.5 py-0.5 rounded ${
                              caller.conversionRate >= 30
                                ? "bg-green-100 text-green-700"
                                : caller.conversionRate >= 15
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-50 text-red-600"
                            }`}
                          >
                            {caller.conversionRate}%
                          </span>
                        </div>
                      </div>
                      {/* Progress: reached pipeline vs total */}
                      <div className="flex gap-1 h-2">
                        <div
                          className="rounded-full bg-green-400"
                          style={{
                            width: `${(caller.reachedPipeline / maxColdCallerTotal) * 100}%`,
                          }}
                          title={`${caller.reachedPipeline} nådde pipeline`}
                        />
                        <div
                          className="rounded-full bg-gray-200"
                          style={{
                            width: `${((caller.total - caller.reachedPipeline) / maxColdCallerTotal) * 100}%`,
                          }}
                          title={`${caller.total - caller.reachedPipeline} stoppet i cold calling`}
                        />
                      </div>
                      <div className="flex gap-3 text-xs text-gray-400">
                        <span className="text-green-600">
                          {caller.reachedPipeline} pipeline
                        </span>
                        {caller.signed > 0 && (
                          <span className="text-emerald-700 font-medium">
                            {caller.signed} signert ·{" "}
                            {formatCurrency(caller.signedValue)} kr
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-300 mt-1">
                    % = andel av egne leads som nådde pipeline
                  </p>
                </div>
              )}
            </Card>

            {/* Bottlenecks */}
            <Card title="Flaskehalser — størst opphoping">
              {bottlenecks.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  Ingen data.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {bottlenecks.map((b, i) => {
                    const maxCount = bottlenecks[0].count;
                    const pct = Math.round((b.count / maxCount) * 100);
                    return (
                      <div key={b.status} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700 truncate max-w-[160px]">
                            {i + 1}. {b.label}
                          </span>
                          <span className="font-bold text-gray-800 ml-2">
                            {b.count}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {b.totalValue > 0 && (
                          <p className="text-xs text-gray-400">
                            {formatCurrency(b.totalValue)} kr
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Installer group comparison */}
            <Card title="Per installatørgruppe">
              {stats.installerGroupStats.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  Ingen data.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.installerGroupStats.map((g) => {
                    const signedRate =
                      g.total > 0 ? Math.round((g.signed / g.total) * 100) : 0;
                    const maxTotal = Math.max(
                      ...stats.installerGroupStats.map((x) => x.total),
                      1,
                    );
                    return (
                      <div key={g.name} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-800 truncate max-w-[140px]">
                            {g.name}
                          </span>
                          <span className="text-gray-400">{g.total} leads</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-400 transition-all"
                            style={{ width: `${(g.total / maxTotal) * 100}%` }}
                          />
                        </div>
                        <div className="flex gap-3 text-xs text-gray-400">
                          <span>
                            <span className="text-emerald-600 font-medium">
                              {g.signed}
                            </span>{" "}
                            signert ({signedRate}%)
                          </span>
                          {g.value > 0 && (
                            <span className="text-gray-500">
                              {formatCurrency(g.value)} kr
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Row 3: Time-series */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* New leads over time */}
            <Card
              title={`Nye leads over tid (${DATE_PRESETS.find((p) => p.value === preset)?.label})`}
            >
              {newLeadsChart.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Ingen leads i perioden.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={newLeadsChart}
                    margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Nye leads"
                      fill="#93c5fd"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Signed over time */}
            <Card
              title={`Signerte avtaler over tid (${DATE_PRESETS.find((p) => p.value === preset)?.label})`}
            >
              {signedChart.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  Ingen signerte avtaler i perioden.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={signedChart}
                    margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickFormatter={(v) => `${v}k`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                            <p className="font-semibold text-gray-800 mb-1">
                              {label}
                            </p>
                            <p className="text-emerald-600">
                              Avtaler: {payload[0]?.value}
                            </p>
                            {(payload[1]?.value as number) > 0 && (
                              <p className="text-violet-600">
                                Verdi: {payload[1]?.value}k kr
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
                      fill="#6ee7b7"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="valueK"
                      name="Verdi (k)"
                      fill="#c4b5fd"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
