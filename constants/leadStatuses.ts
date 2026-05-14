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
