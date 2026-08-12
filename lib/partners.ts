import partnersData from "@/constants/partners.json";

/**
 * En partnerbedrift slik den vises på den offentlige nettsiden.
 * Kilden er constants/partners.json.
 */
export type Partner = {
  slug: string;
  name: string;
  /** Sti under /public, f.eks. "/installerLogos/minelsol.png" */
  logo: string;
  /** Kobling mot installer_groups.site i databasen. */
  installerGroupSite: string;
  published: boolean;
  featured: boolean;
  /** true = innholdet er utkast og ikke kvalitetssikret av partneren. */
  draft: boolean;
  /** Fylke eller landsdel, f.eks. "Vestlandet". Tom streng skjules. */
  region: string;
  /** Byer/steder de dekker. Tom liste skjules. */
  cities: string[];
  /** Én setning til kortvisningen. */
  summary: string;
  /** Avsnitt til partnersiden. */
  about: string;
  services: string[];
  highlights: string[];
  phone: string;
  email: string;
  website: string;
  orgNr: string;
};

const ALL = (partnersData.partners as Partner[]).filter((p) => p.published);

/** Alle publiserte partnere, sortert alfabetisk. */
export function getPartners(): Partner[] {
  return [...ALL].sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

/** Partnerne som skal løftes fram på forsiden. */
export function getFeaturedPartners(): Partner[] {
  const featured = ALL.filter((p) => p.featured);
  return featured.length > 0 ? featured : getPartners();
}

export function getPartner(slug: string): Partner | undefined {
  return ALL.find((p) => p.slug === slug);
}

/** Alle slugs — brukes av generateStaticParams. */
export function getPartnerSlugs(): string[] {
  return ALL.map((p) => p.slug);
}

/** Unike områder, til filtrering på oversiktssiden. */
export function getRegions(): string[] {
  const regions = new Set(ALL.map((p) => p.region).filter(Boolean));
  return [...regions].sort((a, b) => a.localeCompare(b, "nb"));
}

/** Kort stedstekst: "Bergen, Askøy, Os" — faller tilbake til området. */
export function placeLabel(partner: Partner): string {
  if (partner.cities.length > 0) return partner.cities.slice(0, 3).join(", ");
  return partner.region;
}
