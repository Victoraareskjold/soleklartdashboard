import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Icon, type IconName } from "@/app/components/ds";
import { PartnerCard, PartnerLogo } from "@/app/components/site/PartnerCard";
import { SiteShell } from "@/app/components/site/SiteShell";
import { PHONE_HREF, SITE, requestQuoteMailto } from "@/constants/site";
import {
  getPartner,
  getPartnerSlugs,
  getPartners,
  placeLabel,
  type Partner,
} from "@/lib/partners";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPartnerSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const partner = getPartner(slug);
  if (!partner) return { title: `Partner — ${SITE.name}` };

  return {
    title: `${partner.name} — solcelleinstallatør | ${SITE.name}`,
    description:
      partner.summary ||
      `${partner.name} monterer solcelleanlegg${partner.region ? ` i ${partner.region}` : ""}. Be om tilbud gjennom Soleklart.`,
  };
}

/** Rad i kontaktkortet. Skjuler seg selv hvis verdien mangler. */
function DetailRow({
  icon,
  label,
  value,
  href,
}: {
  icon: IconName;
  label: string;
  value?: string;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Icon
        name={icon}
        size={18}
        style={{ color: "var(--brand-primary)", marginTop: 2 }}
      />
      <div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</div>
        <div
          style={{
            fontSize: 15,
            color: "var(--text-heading)",
            fontWeight: "var(--weight-medium)" as unknown as number,
          }}
        >
          {href ? <a href={href}>{value}</a> : value}
        </div>
      </div>
    </div>
  );
}

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "mail",
    title: "Du sender en henvendelse",
    body: "Fortell hvor du bor og litt om taket. Det tar under et minutt.",
  },
  {
    icon: "phone",
    title: "Vi tar en prat",
    body: "Soleklart ringer deg, går gjennom behovet og avtaler befaring.",
  },
  {
    icon: "sun",
    title: "Installatøren monterer",
    body: "Partneren gjør befaring, sender tilbud og står for monteringen.",
  },
];

export default async function PartnerPage({ params }: PageProps) {
  const { slug } = await params;
  const partner = getPartner(slug);
  if (!partner) notFound();

  const others = getPartners()
    .filter((p: Partner) => p.slug !== partner.slug)
    .slice(0, 3);

  const place = placeLabel(partner);
  const quoteHref = requestQuoteMailto(partner.name);

  return (
    <SiteShell>
      {/* ── Topp ─────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "40px 24px 64px",
          background:
            "linear-gradient(180deg, var(--blue-50) 0%, var(--white) 100%)",
        }}
      >
        <div className="sk-container">
          <Link
            href="/partnere"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: "var(--text-muted)",
            }}
          >
            <Icon name="arrow-left" size={15} />
            Alle partnere
          </Link>

          <div style={{ marginTop: 32, maxWidth: 620 }}>
            <div style={{ maxWidth: 260 }}>
              <PartnerLogo partner={partner} height={56} />
            </div>

            <h1 style={{ marginTop: 28, fontSize: "clamp(32px, 4.4vw, 46px)" }}>
              {partner.name}
            </h1>

            {place ? (
              <div style={{ marginTop: 16 }}>
                <Badge tone="brand">
                  <Icon name="map-pin" size={13} />
                  {place}
                </Badge>
              </div>
            ) : null}

            {partner.summary ? (
              <p style={{ marginTop: 20, fontSize: 19, lineHeight: 1.6 }}>
                {partner.summary}
              </p>
            ) : null}

            <div
              style={{
                marginTop: 28,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Button size="lg" href={quoteHref} icon="arrow-right">
                Be om tilbud
              </Button>
              <Button size="lg" variant="outline" href={PHONE_HREF} icon="phone" iconPosition="left">
                Ring {SITE.phone}
              </Button>
            </div>

            <p style={{ marginTop: 16, fontSize: 14, color: "var(--text-muted)" }}>
              Henvendelsen går til Soleklart, som følger den opp sammen med{" "}
              {partner.name}.
            </p>
          </div>
        </div>
      </section>

      {/* ── Om bedriften + kontaktkort ───────────────────────────────── */}
      <section className="sk-section" style={{ paddingTop: 0 }}>
        <div className="sk-container sk-split">
          <div>
            {partner.about ? (
              <>
                <h2 style={{ fontSize: 28 }}>Om {partner.name}</h2>
                <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.65 }}>
                  {partner.about}
                </p>
              </>
            ) : null}

            {partner.services.length > 0 ? (
              <>
                <h3 style={{ marginTop: 40, fontSize: 20 }}>Dette gjør de</h3>
                <ul
                  style={{
                    marginTop: 16,
                    padding: 0,
                    listStyle: "none",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {partner.services.map((service) => (
                    <li
                      key={service}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 16,
                        color: "var(--text-heading)",
                      }}
                    >
                      <Icon
                        name="check-circle"
                        size={18}
                        style={{ color: "var(--status-success-fg)" }}
                      />
                      {service}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {partner.highlights.length > 0 ? (
              <div
                style={{
                  marginTop: 36,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {partner.highlights.map((h) => (
                  <Badge key={h} tone="neutral">
                    {h}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <Card padding="lg" tone="subtle">
            <h3 style={{ fontSize: 18 }}>Kontakt</h3>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <DetailRow icon="map-pin" label="Område" value={partner.region} />
              <DetailRow
                icon="home"
                label="Steder"
                value={partner.cities.join(", ")}
              />
              <DetailRow
                icon="phone"
                label="Telefon"
                value={partner.phone}
                href={partner.phone ? `tel:${partner.phone.replace(/\s+/g, "")}` : undefined}
              />
              <DetailRow
                icon="mail"
                label="E-post"
                value={partner.email}
                href={partner.email ? `mailto:${partner.email}` : undefined}
              />
              <DetailRow
                icon="globe"
                label="Nettside"
                value={partner.website}
                href={partner.website || undefined}
              />
              <DetailRow icon="building" label="Org.nr" value={partner.orgNr} />
            </div>

            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <Button fullWidth href={quoteHref} icon="arrow-right">
                Be om tilbud
              </Button>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                Svar {SITE.responseTime}
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Slik fungerer det ────────────────────────────────────────── */}
      <section
        className="sk-section"
        style={{
          background: "var(--surface-subtle)",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="sk-container">
          <h2 style={{ fontSize: "clamp(27px, 3.4vw, 34px)" }}>
            Slik fungerer det
          </h2>
          <div className="sk-grid-3" style={{ marginTop: 36 }}>
            {STEPS.map((step, i) => (
              <Card key={step.title} padding="lg">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-brand-soft)",
                      color: "var(--brand-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={step.icon} size={20} />
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: "var(--weight-semibold)" as unknown as number,
                      color: "var(--text-muted)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    STEG {i + 1}
                  </span>
                </div>
                <h3 style={{ marginTop: 18, fontSize: 19 }}>{step.title}</h3>
                <p style={{ marginTop: 8, fontSize: 15 }}>{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Andre partnere ───────────────────────────────────────────── */}
      {others.length > 0 ? (
        <section className="sk-section">
          <div className="sk-container">
            <h2 style={{ fontSize: "clamp(24px, 3vw, 30px)" }}>
              Andre installatører
            </h2>
            <div className="sk-grid-3" style={{ marginTop: 32 }}>
              {others.map((p) => (
                <PartnerCard key={p.slug} partner={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Avslutning, rettet mot huseiere ──────────────────────────── */}
      <section
        className="sk-section"
        style={{ background: "var(--surface-brand)" }}
      >
        <div className="sk-container--narrow" style={{ textAlign: "center" }}>
          <h2
            style={{ color: "var(--white)", fontSize: "clamp(26px, 3.6vw, 36px)" }}
          >
            Vurderer du solceller?
          </h2>
          <p style={{ marginTop: 16, fontSize: 18, color: "var(--blue-100)" }}>
            Send en henvendelse, så tar vi en uforpliktende prat om hva som
            passer for taket ditt.
          </p>
          <div style={{ marginTop: 28 }}>
            <Button size="lg" variant="inverse" href={quoteHref} icon="arrow-right">
              Be om tilbud
            </Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
