import Image from "next/image";
import Link from "next/link";
import { Card, Icon } from "@/app/components/ds";
import { placeLabel, type Partner } from "@/lib/partners";

/**
 * Logoene til partnerne har veldig ulike proporsjoner. Boksen holder dem på
 * samme høyde og venstrejustert, slik at rekken ser rolig ut.
 */
export function PartnerLogo({
  partner,
  height = 44,
}: {
  partner: Partner;
  height?: number;
}) {
  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <Image
        src={partner.logo}
        alt={partner.name}
        fill
        sizes="260px"
        style={{ objectFit: "contain", objectPosition: "left center" }}
      />
    </div>
  );
}

export function PartnerCard({ partner }: { partner: Partner }) {
  const place = placeLabel(partner);

  return (
    <Link
      href={`/partnere/${partner.slug}`}
      style={{ display: "block", textDecoration: "none" }}
    >
      <Card
        padding="lg"
        hoverable
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <PartnerLogo partner={partner} />

        <h3 style={{ marginTop: 22, fontSize: 20 }}>{partner.name}</h3>

        {place ? (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            <Icon name="map-pin" size={15} />
            {place}
          </div>
        ) : null}

        {partner.summary ? (
          <p style={{ marginTop: 12, fontSize: 15, flex: 1 }}>{partner.summary}</p>
        ) : null}

        <span
          style={{
            marginTop: 20,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--brand-primary)",
            fontWeight: "var(--weight-semibold)" as unknown as number,
            fontSize: 15,
          }}
        >
          Se profil
          <Icon name="arrow-right" size={16} />
        </span>
      </Card>
    </Link>
  );
}

export default PartnerCard;
