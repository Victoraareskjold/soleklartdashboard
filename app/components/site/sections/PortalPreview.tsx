import { Badge, StatCard, type BadgeTone } from "@/app/components/ds";

/**
 * Illustrasjon av partnerportalen. Rene demodata — dette er et bilde av
 * produktet, ikke ekte tall. Navnene er huseiere, fordi det er dem
 * Soleklart kontakter på vegne av partnerne.
 */
const LEADS: { name: string; place: string; tone: BadgeTone; label: string }[] = [
  { name: "Ingrid Hansen", place: "Bergen · Skråtak", tone: "success", label: "Vunnet" },
  { name: "Ola Nordvik", place: "Ålesund · Flatt tak", tone: "brand", label: "Kontaktet" },
  { name: "Familien Lia", place: "Trondheim · Skråtak", tone: "warning", label: "Venter" },
];

export function PortalPreview() {
  return (
    <div
      aria-hidden="true"
      style={{
        background: "var(--white)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-lg)",
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 14,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--grey-300)",
          }}
        />
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--grey-200)",
          }}
        />
        <span style={{ marginLeft: 8, fontSize: 13, color: "var(--text-muted)" }}>
          Partnerportal · Dashbord
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 16,
        }}
      >
        <StatCard label="Nye leads" value="24" delta="+6 denne uken" icon="users" />
        <StatCard
          label="Tilbud sendt"
          value="11"
          delta="+2 denne uken"
          icon="file-text"
        />
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {LEADS.map((lead) => (
          <div
            key={lead.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: "var(--weight-semibold)" as unknown as number,
                  color: "var(--text-heading)",
                }}
              >
                {lead.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {lead.place}
              </div>
            </div>
            <Badge tone={lead.tone} dot={lead.tone !== "warning"}>
              {lead.label}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PortalPreview;
