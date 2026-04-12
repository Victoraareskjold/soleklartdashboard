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
// Pipeline + closing only (excludes cold calling stage 5) — used for installer group stats
const INSTALLER_PIPELINE_STATUSES = new Set([
  7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21,
]);

// Inbound traffic sources — add new entries here to support more channels
const INBOUND_SOURCES: { key: string; label: string }[] = [
  { key: "google", label: "Google" },
  { key: "facebook", label: "Facebook" },
  { key: "organic", label: "Organic" },
];

/**
 * Detects if a lead is inbound (came via a web form) and which channel it's from.
 * Returns null for cold-call leads (no "Tracking:" section in note).
 * Priority: fbclid → gclid → organic
 */
function parseInboundSource(note: string | null): string | null {
  if (!note || !note.includes("Tracking:")) return null;
  if (/fbclid:\s*\S/.test(note)) return "facebook";
  if (/gclid:\s*\S/.test(note)) return "google";
  return "organic";
}

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
      note: string | null;
      lead_source: string | null;
    }[] = [];

    let offset = 0;
    while (true) {
      const { data, error } = await client
        .from("leads")
        .select(
          "id, status, created_at, updated_at, updated_price, assigned_to, created_by, installer_group_id, note, lead_source",
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

    // Cold caller activity filter: leads touched (updated) in the period,
    // regardless of when they were created. A caller may work leads
    // created before the selected window.
    const callerPeriodLeads = leads.filter((l) => {
      const d = new Date(l.updated_at ?? l.created_at ?? "");
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
    // Tracks calling activity per person:
    // - assigned: total leads assigned (their "numbers")
    // - called: leads they've actually worked (not still sitting at status 2 "Ring opp")
    // - converted: reached pipeline (status 5 "Vil ha tilbud" or beyond)
    // - notInterested: status 3 or 16
    // - noAnswer: status 4 or 22
    const coldCallerAgg: Record<
      string,
      {
        name: string;
        assigned: number;
        called: number;
        converted: number;
        notInterested: number;
        noAnswer: number;
      }
    > = {};

    coldCallerMembers.forEach((m) => {
      coldCallerAgg[m.user_id] = {
        name: memberMap[m.user_id] || "Ukjent",
        assigned: 0,
        called: 0,
        converted: 0,
        notInterested: 0,
        noAnswer: 0,
      };
    });

    callerPeriodLeads.forEach((lead) => {
      const userId = lead.assigned_to;
      if (!userId || !coldCallerAgg[userId]) return;
      coldCallerAgg[userId].assigned++;

      const s = lead.status;
      if (!s) return;

      // Worked through = not still waiting to be called (status 2)
      if (s !== 2) {
        coldCallerAgg[userId].called++;
      }

      // Results
      if (PIPELINE_STATUSES.has(s)) {
        coldCallerAgg[userId].converted++;
      } else if (s === 3 || s === 16) {
        coldCallerAgg[userId].notInterested++;
      } else if (s === 4 || s === 22) {
        coldCallerAgg[userId].noAnswer++;
      }
    });

    const coldCallerStats = Object.values(coldCallerAgg)
      .filter((c) => c.assigned > 0)
      .map((c) => ({
        ...c,
        conversionRate:
          c.assigned > 0
            ? Math.round((c.converted / c.assigned) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.converted - a.converted || b.assigned - a.assigned);

    // ── Inbound / warm lead stats (by traffic source) ────────────────────────
    const inboundAgg: Record<
      string,
      {
        label: string;
        assigned: number;
        called: number;
        converted: number;
        notInterested: number;
        noAnswer: number;
      }
    > = {};
    INBOUND_SOURCES.forEach((src) => {
      inboundAgg[src.key] = {
        label: src.label,
        assigned: 0,
        called: 0,
        converted: 0,
        notInterested: 0,
        noAnswer: 0,
      };
    });

    periodLeads.forEach((lead) => {
      // Prefer stored lead_source; fall back to note-parsing for old records
      const source =
        lead.lead_source && lead.lead_source !== "cold_call"
          ? lead.lead_source
          : parseInboundSource(lead.note);
      if (!source || !inboundAgg[source]) return;
      inboundAgg[source].assigned++;

      const s = lead.status;
      if (!s) return;
      if (s !== 2) inboundAgg[source].called++;

      if (PIPELINE_STATUSES.has(s)) {
        inboundAgg[source].converted++;
      } else if (s === 3 || s === 16) {
        inboundAgg[source].notInterested++;
      } else if (s === 4 || s === 22) {
        inboundAgg[source].noAnswer++;
      }
    });

    const inboundStats = INBOUND_SOURCES.map((src) => ({
      source: src.key,
      ...inboundAgg[src.key],
      conversionRate:
        inboundAgg[src.key].assigned > 0
          ? Math.round(
              (inboundAgg[src.key].converted / inboundAgg[src.key].assigned) *
                1000,
            ) / 10
          : 0,
    }));

    // ── Installer group stats ─────────────────────────────────────────────────
    const installerGroupAgg: Record<
      string,
      { name: string; total: number; signed: number; value: number }
    > = {};

    leads.forEach((lead) => {
      const gid = lead.installer_group_id;
      if (!gid) return;
      if (!lead.status || !INSTALLER_PIPELINE_STATUSES.has(lead.status)) return;
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

    // ── Pipeline tracking (A–E) ───────────────────────────────────────────────
    // A: Tapte leads
    const notInterested = leads.filter(
      (l) => l.status === 3 || l.status === 16,
    ).length;
    const newsletter = leads.filter((l) => l.status === 11).length;
    const lost = notInterested + newsletter;

    // B: Aktive i grønn pipeline (dialog → venter på signering)
    const ACTIVE_PIPELINE = new Set([12, 13, 14, 15, 17]);
    const activePipeline = leads.filter(
      (l) => l.status && ACTIVE_PIPELINE.has(l.status),
    ).length;

    // All-time signed estimates (not period-filtered) — needed for C and D.
    // Chunked to avoid URL length limits on large .in() filters.
    const allSignedLeadIds = new Set<string>();
    const CHUNK = 200;
    for (let i = 0; i < leads.length; i += CHUNK) {
      const ids = leads.slice(i, i + CHUNK).map((l) => l.id);
      const { data: chunk } = await client
        .from("estimates")
        .select("lead_id")
        .not("signed_at", "is", null)
        .in("lead_id", ids);
      (chunk || []).forEach((e) => allSignedLeadIds.add(e.lead_id));
    }

    // C: Signerte (har noen gang hatt en signert avtale)
    const everSigned = leads.filter((l) => allSignedLeadIds.has(l.id)).length;

    // D: Signert men aldri ferdig montert (status 20/21)
    const MOUNTED = new Set([20, 21]);
    const signedNotMounted = leads.filter(
      (l) => allSignedLeadIds.has(l.id) && (!l.status || !MOUNTED.has(l.status)),
    ).length;

    // E: Kommisjon utbetalt
    const commissionPaid = leads.filter((l) => l.status === 21).length;

    // ── Lost lead depth (milestone journey analysis) ──────────────────────────
    // For each lost lead, determine the deepest pipeline stage they ever reached.
    // Uses status history for leads that have it; falls back to current status
    // for older leads recorded before history tracking was introduced.
    const lostLeads = leads.filter(
      (l) => l.status === 3 || l.status === 16 || l.status === 11,
    );
    const lostLeadIds = lostLeads.map((l) => l.id);

    // Collect all status values ever seen for each lost lead
    const leadHistoryStatuses = new Map<string, Set<number>>();
    for (let i = 0; i < lostLeadIds.length; i += CHUNK) {
      const ids = lostLeadIds.slice(i, i + CHUNK);
      const { data: historyChunk } = await client
        .from("lead_status_history")
        .select("lead_id, to_status")
        .in("lead_id", ids);
      (historyChunk || []).forEach((h: { lead_id: string; to_status: number }) => {
        if (!leadHistoryStatuses.has(h.lead_id)) {
          leadHistoryStatuses.set(h.lead_id, new Set());
        }
        leadHistoryStatuses.get(h.lead_id)!.add(h.to_status);
      });
    }

    const MILESTONE_FOLLOW_UP = new Set([7, 8, 9, 10, 11]);
    const MILESTONE_DIALOG = new Set([12, 13, 14, 15]);
    const MILESTONE_OFFER = new Set([17]);
    const MILESTONE_SIGNED_HIST = new Set([18, 19, 20, 21]);

    const getLostMilestone = (lead: (typeof leads)[0]): string => {
      const history = leadHistoryStatuses.get(lead.id);
      if (!history || history.size === 0) {
        // No history recorded yet — infer from current status:
        // status 16 means they were in the pipeline before falling out
        if (lead.status === 16) return "pipeline";
        // status 11 (newsletter) is a pipeline stage
        if (lead.status === 11) return "pipeline";
        return "cold_calling";
      }
      if ([...MILESTONE_SIGNED_HIST].some((s) => history.has(s))) return "signed";
      if ([...MILESTONE_OFFER].some((s) => history.has(s))) return "offer";
      if ([...MILESTONE_DIALOG].some((s) => history.has(s))) return "dialog";
      if ([...MILESTONE_FOLLOW_UP].some((s) => history.has(s))) return "pipeline";
      return "cold_calling";
    };

    const lostByDepth = {
      coldCalling: 0,
      pipeline: 0,
      dialog: 0,
      offer: 0,
      signed: 0,
    };
    lostLeads.forEach((lead) => {
      const milestone = getLostMilestone(lead) as keyof typeof lostByDepth;
      lostByDepth[milestone]++;
    });

    return NextResponse.json({
      funnel,
      coldCallerStats,
      inboundStats,
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
      pipelineTracking: {
        lost,
        notInterested,
        newsletter,
        activePipeline,
        everSigned,
        signedNotMounted,
        commissionPaid,
        lostByDepth,
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
