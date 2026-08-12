import { Card, Icon, type IconName } from "@/app/components/ds";

const SERVICES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "users",
    title: "Leads",
    body: "Vi kjører annonser og sosiale medier mot huseiere i ditt område, og sender de kvalifiserte henvendelsene rett inn i portalen.",
  },
  {
    icon: "file-text",
    title: "Salg og tilbud",
    body: "Ferdige maler og priser gjør at tilbudet kan gå ut samme dag som kunden tar kontakt.",
  },
  {
    icon: "phone",
    title: "Oppfølging",
    body: "Vi ringer kundene som ikke har svart, så ingen henvendelse blir liggende.",
  },
  {
    icon: "trending-up",
    title: "Oversikt",
    body: "Alle leads, tilbud og prosjekter samlet ett sted, med status du kan stole på.",
  },
];

export function Services() {
  return (
    <section
      id="hva-vi-hjelper-med"
      className="sk-section"
      style={{
        background: "var(--surface-subtle)",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="sk-container">
        <h2 style={{ fontSize: "clamp(27px, 3.4vw, 36px)", maxWidth: 620 }}>
          Dette hjelper vi partnerne våre med
        </h2>

        <div className="sk-grid-2" style={{ marginTop: 40 }}>
          {SERVICES.map((service) => (
            <Card key={service.title} padding="lg" hoverable>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface-brand-soft)",
                  color: "var(--brand-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={service.icon} size={22} />
              </div>
              <h3 style={{ marginTop: 18, fontSize: 22 }}>{service.title}</h3>
              <p style={{ marginTop: 10, fontSize: 16 }}>{service.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Services;
