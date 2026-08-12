import { Button } from "@/app/components/ds";
import { getFeaturedPartners, getPartners } from "@/lib/partners";
import { PartnerCard } from "../PartnerCard";

export function Partners() {
  const featured = getFeaturedPartners().slice(0, 3);
  const total = getPartners().length;

  if (featured.length === 0) return null;

  return (
    <section id="partnere" className="sk-section">
      <div className="sk-container">
        <div
          className="sk-split"
          style={{ alignItems: "end", marginBottom: 40 }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: "var(--weight-semibold)" as unknown as number,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              Partnerne våre
            </div>
            <h2
              style={{
                marginTop: 14,
                fontSize: "clamp(27px, 3.4vw, 36px)",
                maxWidth: 560,
              }}
            >
              {total} installatører over hele landet
            </h2>
            <p style={{ marginTop: 16, fontSize: 18, maxWidth: 520 }}>
              Alle er autoriserte elektrobedrifter som monterer selv. Er du
              huseier, finner du den som dekker ditt område her.
            </p>
          </div>
        </div>

        <div className="sk-grid-3">
          {featured.map((partner) => (
            <PartnerCard key={partner.slug} partner={partner} />
          ))}
        </div>
        <div className="mt-4">
          <Button variant={"ghost"} href="/partnere" icon="arrow-right">
            Se alle partnere
          </Button>
        </div>
      </div>
    </section>
  );
}

export default Partners;
