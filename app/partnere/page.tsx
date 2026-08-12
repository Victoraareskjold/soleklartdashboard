import type { Metadata } from "next";
import { SITE } from "@/constants/site";
import { SiteShell } from "@/app/components/site/SiteShell";
import { PartnerDirectory } from "@/app/components/site/PartnerDirectory";
import { ClosingCta } from "@/app/components/site/sections/ClosingCta";
import { getPartners, getRegions } from "@/lib/partners";

export const metadata: Metadata = {
  title: `Partnere — ${SITE.name}`,
  description:
    "Solcelleinstallatørene Soleklart samarbeider med. Autoriserte elektrobedrifter som monterer selv, over hele landet.",
};

export default function PartnersPage() {
  const partners = getPartners();
  const regions = getRegions();

  return (
    <SiteShell>
      <section
        style={{
          padding: "72px 24px 56px",
          background:
            "linear-gradient(180deg, var(--blue-50) 0%, var(--white) 100%)",
        }}
      >
        <div className="sk-container--narrow">
          <h1 style={{ fontSize: "clamp(34px, 4.6vw, 48px)" }}>
            Installatørene våre
          </h1>
          <p style={{ marginTop: 18, fontSize: 19, lineHeight: 1.6 }}>
            Soleklart samarbeider med autoriserte elektrobedrifter som monterer
            solcelleanlegg selv. Finn den som dekker ditt område — så tar vi
            kontakten videre.
          </p>
        </div>
      </section>

      <section className="sk-section" style={{ paddingTop: 24 }}>
        <div className="sk-container">
          <PartnerDirectory partners={partners} regions={regions} />
        </div>
      </section>

      <ClosingCta />
    </SiteShell>
  );
}
