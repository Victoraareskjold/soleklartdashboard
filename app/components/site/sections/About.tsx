import { Icon, type IconName } from "@/app/components/ds";

const POINTS: { label: string; icon: IconName }[] = [
  { label: "Norsk og lokalt", icon: "map-pin" },
  { label: "Faste kontaktpersoner", icon: "phone" },
  { label: "Ingen bindingstid", icon: "shield-check" },
];

export function About() {
  return (
    <section id="om-soleklart" className="sk-section">
      <div className="sk-container--narrow" style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: "var(--weight-semibold)" as unknown as number,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Hva Soleklart er
        </div>

        <h2 style={{ marginTop: 14, fontSize: "clamp(27px, 3.4vw, 36px)" }}>
          Vi er markedsavdelingen til solbransjen
        </h2>

        <p style={{ marginTop: 18, fontSize: 19, lineHeight: 1.6 }}>
          Soleklart samarbeider med bedrifter innen solenergi og elektro. Vi
          jobber for installatørene — men det er huseierne vi snakker med. Vi
          henter inn kundene, holder orden på henvendelsene og sørger for at
          tilbudene går ut i tide, slik at partnerne våre kan bruke tiden på
          montering.
        </p>

        <div
          style={{
            marginTop: 36,
            display: "flex",
            gap: 40,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {POINTS.map((point) => (
            <div
              key={point.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--text-heading)",
                fontWeight: "var(--weight-medium)" as unknown as number,
                fontSize: 15,
              }}
            >
              <Icon
                name={point.icon}
                size={18}
                style={{ color: "var(--brand-primary)" }}
              />
              {point.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default About;
