export const LeadStatus = [
  { value: 1, label: "Annet", color: "#989898" },
  { value: 2, label: "Ring opp", color: "#FFDB59" },
  { value: 3, label: "Ikke interessert", color: "#626262" },
  { value: 4, label: "Ikke svart - ring igjen", color: "#FF5959" },
  { value: 22, label: "Dobbel ringt, ingen svar", color: "#C50003" },
  { value: 5, label: "Vil ha tilbud", color: "#69FF59" },
];

// Pure cold calling statuses — lead has not yet entered the pipeline
export const COLDCALLING_STATUSES = new Set([0]);

// All statuses that count as "entered pipeline" — includes lost/dead leads
export const PIPELINE_STATUSES_ALL = new Set([1, 2, 3, 4, 5, 16, 22]);

export const NOT_INTERESTED_STATUS = 16;

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
