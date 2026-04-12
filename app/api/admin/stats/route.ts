import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

// Canonical pipeline order — used for funnel + bottleneck views
export const FUNNEL_STAGES = [
  // Cold calling
  { value: 2, label: "Ring opp", color: "#FFDB59", group: "cold" },
  {
    value: 4,
    label: "Ikke svart - ring igjen",
    color: "#FF5959",
    group: "cold",
  },
  {
    value: 22,
    label: "Dobbel ringt, ingen svar",
    color: "#C50003",
    group: "cold",
  },
  { value: 5, label: "Vil ha tilbud", color: "#69FF59", group: "cold" },
  // Pipeline
  { value: 7, label: "Oppfølging 1", color: "#FBF586", group: "pipeline" },
  { value: 8, label: "Oppfølging 2", color: "#FBF586", group: "pipeline" },
  { value: 9, label: "Oppfølging 3", color: "#FBF586", group: "pipeline" },
  { value: 10, label: "Oppfølging 4", color: "#FBF586", group: "pipeline" },
  { value: 11, label: "Nyhetsbrev", color: "#ECE171", group: "pipeline" },
  {
    value: 12,
    label: "Privatkunder (dialog)",
    color: "#DAFFB7",
    group: "pipeline",
  },
  {
    value: 13,
    label: "Næringskunder (dialog)",
    color: "#DAFFB7",
    group: "pipeline",
  },
  {
    value: 14,
    label: "Venter på befaring",
    color: "#DAFFB7",
    group: "pipeline",
  },
  {
    value: 15,
    label: "Tilleggsinfo / Korrigering",
    color: "#DAFFB7",
    group: "pipeline",
  },
  {
    value: 17,
    label: "Venter på signering",
    color: "#A3FFA3",
    group: "closing",
  },
  {
    value: 18,
    label: "Salg Fullført & Signert",
    color: "#6DFF68",
    group: "closing",
  },
  {
    value: 19,
    label: "Planlagt Installasjon",
    color: "#6DFF68",
    group: "closing",
  },
  {
    value: 20,
    label: "Anlegg Ferdigmontert",
    color: "#08FF00",
    group: "closing",
  },
  {
    value: 21,
    label: "Kommisjon Utbetalt",
    color: "#08FF00",
    group: "closing",
  },
  // Dead
  { value: 1, label: "Annet", color: "#989898", group: "dead" },
  { value: 3, label: "Ikke interessert", color: "#626262", group: "dead" },
  {
    value: 16,
    label: "Ikke interessert (pipeline)",
    color: "#FF7979",
    group: "dead",
  },
];

// Statuses that count as "reached pipeline" (quality lead from cold caller)
const PIPELINE_STATUSES = new Set([
  5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21,
]);
const SIGNED_STATUSES = new Set([18, 19, 20, 21]);

type GroupBy = "day" | "week" | "month";

function groupByPeriod(
  items: { date: string; count: number; value: number }[],
  groupBy: GroupBy,
): { period: string; count: number; value: number }[] {
  const map = new Map<string, { count: number; value: number }>();
  items.forEach((item) => {
    const d = new Date(item.date);
    let key: string;
    if (groupBy === "day") {
      key = d.toISOString().split("T")[0];
    } else if (groupBy === "week") {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      key = monday.toISOString().split("T")[0];
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (!map.has(key)) map.set(key, { count: 0, value: 0 });
    const entry = map.get(key)!;
    entry.count += item.count;
    entry.value += item.value;
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, stats]) => ({ period, ...stats }));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("teamId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const groupBy = (url.searchParams.get("groupBy") || "week") as GroupBy;

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!teamId || !from || !to)
      return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const client = createSupabaseClient(token);

    // Fetch ALL leads for this team — paginate to bypass the 1000-row default
    const PAGE_SIZE = 1000;
    const leads: {
      id: string;
      status: number | null;
      created_at: string | null;
      updated_at: string | null;
      updated_price: number | null;
      assigned_to: string | null;
      created_by: string | null;
      installer_group_id: string | null;
    }[] = [];

    let offset = 0;
    while (true) {
      const { data, error } = await client
        .from("leads")
        .select(
          "id, status, created_at, updated_at, updated_price, assigned_to, created_by, installer_group_id",
        )
        .eq("team_id", teamId)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      leads.push(...data);
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Period filter
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const periodLeads = leads.filter((l) => {
      if (!l.created_at) return false;
      const d = new Date(l.created_at);
      return d >= fromDate && d <= toDate;
    });

    // Signed estimates in period — also paginate
    const signedEstimates: {
      id: string;
      lead_id: string;
      signed_at: string;
      price_data: unknown;
    }[] = [];
    let estOffset = 0;
    while (true) {
      const { data } = await client
        .from("estimates")
        .select("id, lead_id, signed_at, price_data")
        .not("signed_at", "is", null)
        .gte("signed_at", from)
        .lte("signed_at", toDate.toISOString())
        .range(estOffset, estOffset + PAGE_SIZE - 1);

      if (!data || data.length === 0) break;
      signedEstimates.push(...data);
      if (data.length < PAGE_SIZE) break;
      estOffset += PAGE_SIZE;
    }

    // Lead value lookup
    const leadValueMap: Record<string, number> = {};
    leads.forEach((l) => {
      leadValueMap[l.id] = l.updated_price || 0;
    });

    // Fetch all team members (role + user_id only — team_members has no name column)
    const { data: teamMembersData } = await client
      .from("team_members")
      .select("user_id, role, installer_group_id")
      .eq("team_id", teamId);
    const allTeamMembers = teamMembersData || [];

    // Cold callers = everyone who is NOT an installer (member + admin both cold call)
    const coldCallerMembers = allTeamMembers.filter(
      (m) =>
        m.role !== "installer" &&
        m.user_id !== "29055a66-f819-411b-b334-18def16f36b6" &&
        m.user_id !== "1fa66993-1595-413f-94b6-e35a3a1e4560",
    );
    const coldCallerUserIds = coldCallerMembers.map((m) => m.user_id);

    // Resolve names from users table (the only source of truth for names)
    const memberMap: Record<string, string> = {};
    if (coldCallerUserIds.length > 0) {
      const { data: usersData } = await client
        .from("users")
        .select("id, name")
        .in("id", coldCallerUserIds);
      (usersData || []).forEach((u) => {
        if (u.name) memberMap[u.id] = u.name;
      });
    }

    // Installer groups
    const { data: installerGroupsData } = await client
      .from("installer_groups")
      .select("id, name")
      .eq("team_id", teamId);
    const groupNameMap: Record<string, string> = {};
    (installerGroupsData || []).forEach((g) => {
      groupNameMap[g.id] = g.name;
    });

    // ── Pipeline funnel (current snapshot, all leads) ─────────────────────────
    const statusAgg: Record<number, { count: number; totalValue: number }> = {};
    leads.forEach((lead) => {
      const status = lead.status;
      if (!status) return;
      if (!statusAgg[status]) statusAgg[status] = { count: 0, totalValue: 0 };
      statusAgg[status].count++;
      statusAgg[status].totalValue += lead.updated_price || 0;
    });

    const funnel = FUNNEL_STAGES.map((s) => ({
      status: s.value,
      label: s.label,
      color: s.color,
      group: s.group,
      count: statusAgg[s.value]?.count || 0,
      totalValue: statusAgg[s.value]?.totalValue || 0,
    }));

    // ── Cold-caller stats ─────────────────────────────────────────────────────
    // Start from the full cold-caller member list so everyone shows up (even with 0 leads)
    const coldCallerAgg: Record<
      string,
      {
        name: string;
        total: number;
        reachedPipeline: number;
        signed: number;
        signedValue: number;
      }
    > = {};

    coldCallerMembers.forEach((m) => {
      coldCallerAgg[m.user_id] = {
        name: memberMap[m.user_id] || "Ukjent",
        total: 0,
        reachedPipeline: 0,
        signed: 0,
        signedValue: 0,
      };
    });

    leads.forEach((lead) => {
      const userId = lead.assigned_to;
      if (!userId || !coldCallerAgg[userId]) return;
      coldCallerAgg[userId].total++;
      if (lead.status && PIPELINE_STATUSES.has(lead.status)) {
        coldCallerAgg[userId].reachedPipeline++;
      }
      if (lead.status && SIGNED_STATUSES.has(lead.status)) {
        coldCallerAgg[userId].signed++;
        coldCallerAgg[userId].signedValue += lead.updated_price || 0;
      }
    });

    const coldCallerStats = Object.values(coldCallerAgg)
      .map((c) => ({
        ...c,
        conversionRate:
          c.total > 0
            ? Math.round((c.reachedPipeline / c.total) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.reachedPipeline - a.reachedPipeline);

    // ── Installer group stats ─────────────────────────────────────────────────
    const installerGroupAgg: Record<
      string,
      { name: string; total: number; signed: number; value: number }
    > = {};

    leads.forEach((lead) => {
      const gid = lead.installer_group_id;
      if (!gid) return;
      if (!installerGroupAgg[gid]) {
        installerGroupAgg[gid] = {
          name: groupNameMap[gid] || "Ukjent gruppe",
          total: 0,
          signed: 0,
          value: 0,
        };
      }
      installerGroupAgg[gid].total++;
      installerGroupAgg[gid].value += lead.updated_price || 0;
      if (lead.status && SIGNED_STATUSES.has(lead.status)) {
        installerGroupAgg[gid].signed++;
      }
    });

    const installerGroupStats = Object.values(installerGroupAgg).sort(
      (a, b) => b.total - a.total,
    );

    // ── Time series ───────────────────────────────────────────────────────────
    const newLeadsOverTime = groupByPeriod(
      periodLeads.map((l) => ({
        date: l.created_at!,
        count: 1,
        value: l.updated_price || 0,
      })),
      groupBy,
    );

    const signedOverTime = groupByPeriod(
      signedEstimates.map((e) => ({
        date: e.signed_at,
        count: 1,
        value:
          leadValueMap[e.lead_id] ||
          (e.price_data as Record<string, number> | null)?.total ||
          0,
      })),
      groupBy,
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    const signedCount = signedEstimates.length;
    const signedValue = signedEstimates.reduce(
      (sum, e) =>
        sum +
        (leadValueMap[e.lead_id] ||
          (e.price_data as Record<string, number> | null)?.total ||
          0),
      0,
    );
    const pipelineValue = leads
      .filter((l) => l.status && PIPELINE_STATUSES.has(l.status))
      .reduce((sum, l) => sum + (l.updated_price || 0), 0);

    const activeLeads = leads.filter(
      (l) => l.status && !new Set([1, 3, 16]).has(l.status),
    ).length;

    return NextResponse.json({
      funnel,
      coldCallerStats,
      installerGroupStats,
      newLeadsOverTime,
      signedOverTime,
      summary: {
        totalLeads: leads.length,
        activeLeads,
        newInPeriod: periodLeads.length,
        signedInPeriod: signedCount,
        signedValueInPeriod: signedValue,
        pipelineValue,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/stats error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
