import { CLIENT_ROUTES } from "@/constants/routes";
import { BECOME_PARTNER_MAILTO } from "@/constants/site";
import { Badge, Button, Icon } from "@/app/components/ds";
import { PortalPreview } from "./PortalPreview";

export function Hero() {
  return (
    <section
      style={{
        padding: "96px 24px 88px",
        background:
          "linear-gradient(180deg, var(--blue-50) 0%, var(--white) 100%)",
      }}
    >
      <div className="sk-container sk-hero-grid">
        <div>
          <Badge tone="brand" dot>
            For solenergi og elektro
          </Badge>

          <h1
            style={{
              marginTop: 20,
              fontSize: "clamp(38px, 5.4vw, 60px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Flere prosjekter.
            <br />
            Mindre styr.
          </h1>

          <p
            style={{
              marginTop: 20,
              fontSize: 20,
              lineHeight: 1.55,
              maxWidth: 520,
            }}
          >
            Soleklart jobber for solenergi- og elektrobedrifter. Vi tar kontakten
            med huseierne — du får ferdige henvendelser, tilbud og oppfølging
            samlet i én portal.
          </p>

          <div
            style={{
              marginTop: 32,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Button
              size="lg"
              icon="log-in"
              iconPosition="left"
              href={CLIENT_ROUTES.AUTH}
            >
              Logg inn
            </Button>
            <Button size="lg" variant="outline" href={BECOME_PARTNER_MAILTO}>
              Bli partner
            </Button>
          </div>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            <Icon name="shield-check" size={17} />
            Er du allerede partner? Logg inn for å se leads og prosjekter.
          </div>
        </div>

        <div className="sk-hide-mobile">
          <PortalPreview />
        </div>
      </div>
    </section>
  );
}

export default Hero;
