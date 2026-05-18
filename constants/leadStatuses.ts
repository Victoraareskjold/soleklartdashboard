// ─── Unworked / imported ─────────────────────────────────────────────────────
// Leads get status 0 when imported via the cold calling import tool.
// They stay at 0 until a caller first touches them (moves to status 2+).
// Status 0 leads should NOT count as called or active — they are a queue.

/** Status assigned to leads on import, before any calling has happened. */
export const UNWORKED_STATUS = 0;

// ─── Cold calling phase ───────────────────────────────────────────────────────
// Leads start here. They either die (1/3) or get promoted to pipeline via
// status 5 ("Vil ha tilbud").

/** Status objects shown in the cold calling UI picker. */
export const LeadStatus = [
  { value: 1, label: "Annet", color: "#989898" },
  { value: 2, label: "Ring opp", color: "#FFDB59" },
  { value: 3, label: "Ikke interessert", color: "#626262" },
  { value: 4, label: "Ikke svart - ring igjen", color: "#FF5959" },
  { value: 22, label: "Dobbel ringt, ingen svar", color: "#C50003" },
  { value: 5, label: "Vil ha tilbud", color: "#69FF59" },
];

/** Every status in the cold calling phase (active + dead). */
export const COLDCALL_STATUSES = new Set([1, 2, 3, 4, 5, 22]);

/** No-answer statuses during cold calling. */
export const NO_ANSWER_STATUSES = new Set([4, 22]);

/** Dead statuses that originate from cold calling (gave up before pipeline). */
export const COLDCALL_DEAD_STATUSES = new Set([1, 3]);

// ─── Pipeline phase ───────────────────────────────────────────────────────────
// Lead has passed cold calling and is being actively worked.

/** Statuses where the lead is in active sales pipeline follow-up. */
export const PIPELINE_STATUSES = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15]);

/** "Not interested" status for leads that gave up *after* entering the pipeline. */
export const NOT_INTERESTED_STATUS = 16;

// ─── Closing phase ────────────────────────────────────────────────────────────

/** All closing statuses (from "venter på signering" to "kommisjon utbetalt"). */
export const CLOSING_STATUSES = new Set([17, 18, 19, 20, 21]);

/** Statuses where a contract has been signed (deal is won). */
export const SIGNED_STATUSES = new Set([18, 19, 20, 21]);

// ─── Cross-phase helpers ──────────────────────────────────────────────────────

/**
 * All currently active statuses — lead is being worked in pipeline or closing.
 * Excludes cold calling phase and all dead statuses.
 */
export const ACTIVE_STATUSES = new Set([
  7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21,
]);

/**
 * Statuses that count as "qualified" — lead has passed the cold calling filter.
 * Includes status 5 ("Vil ha tilbud") as the bridge from cold call → pipeline.
 */
export const QUALIFIED_STATUSES = new Set([
  5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21,
]);

/** Every dead/lost status across all phases. */
export const DEAD_STATUSES = new Set([1, 3, 16]);

// ─── Pipeline UI statuses ─────────────────────────────────────────────────────
// Shown in the pipeline / installer view (post cold calling).

export const LEAD_STATUSES = [
  { value: 7, label: "Oppfølging 1", color: "#FBF586" },
  { value: 8, label: "Oppfølging 2", color: "#FBF586" },
  { value: 9, label: "Oppfølging 3", color: "#FBF586" },
  { value: 10, label: "Oppfølging 4", color: "#FBF586" },
  { value: 11, label: "Nyhetsbrev (Langsiktig Nuturing)", color: "#ECE171" },
  { value: 12, label: "Privatkunder (Dialog pågår)", color: "#DAFFB7" },
  { value: 13, label: "Næringskunder (Dialog pågår)", color: "#DAFFB7" },
  { value: 14, label: "Venter på befaring", color: "#DAFFB7" },
  { value: 15, label: "Tilleggsinfo / Korrigering", color: "#DAFFB7" },
  { value: NOT_INTERESTED_STATUS, label: "Ikke interessert", color: "#FF7979" },
  { value: 17, label: "Venter på signering", color: "#A3FFA3" },
  { value: 18, label: "Salg Fullført & Avtale Signert", color: "#6DFF68" },
  { value: 19, label: "Planlagt Installasjon", color: "#6DFF68" },
  { value: 20, label: "Anlegg Ferdigmontert", color: "#08FF00" },
  { value: 21, label: "Kommisjon Utbetalt", color: "#08FF00" },
];

export const LEAD_STATUS_SET = new Set(LEAD_STATUSES.map((s) => s.value));
