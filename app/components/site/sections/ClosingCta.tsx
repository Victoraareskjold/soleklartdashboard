import { CLIENT_ROUTES } from "@/constants/routes";
import { BECOME_PARTNER_MAILTO, SITE } from "@/constants/site";
import { Button } from "@/app/components/ds";

export function ClosingCta() {
  return (
    <section
      className="sk-section"
      style={{ background: "var(--surface-brand)" }}
    >
      <div className="sk-container--narrow" style={{ textAlign: "center" }}>
        <h2 style={{ color: "var(--white)", fontSize: "clamp(28px, 4vw, 40px)" }}>
          Klar for å komme i gang?
        </h2>

        <p style={{ marginTop: 16, fontSize: 19, color: "var(--blue-100)" }}>
          Partnere logger inn i portalen. Er dere en ny bedrift, ta kontakt — vi
          svarer {SITE.responseTime}.
        </p>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Button
            size="lg"
            variant="inverse"
            icon="log-in"
            iconPosition="left"
            href={CLIENT_ROUTES.AUTH}
          >
            Logg inn
          </Button>
          <Button size="lg" variant="secondary" href={BECOME_PARTNER_MAILTO}>
            Bli partner
          </Button>
        </div>
      </div>
    </section>
  );
}

export default ClosingCta;
