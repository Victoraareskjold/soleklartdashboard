/**
 * Kontaktinfo og generell informasjon om Soleklart.
 *
 * Alt som vises på den offentlige nettsiden hentes herfra — ingen e-post,
 * telefonnummer eller org.nr skal skrives direkte inn i en komponent.
 *
 * TODO(Victor): bytt ut verdiene under med de faktiske. Feltene er markert.
 */
export const SITE = {
  name: "Soleklart",
  legalName: "Soleklart AS",
  tagline: "Flere prosjekter. Mindre styr.",
  description:
    "Soleklart jobber for solenergi- og elektrobedrifter i Norge. Vi henter inn kundene, følger opp henvendelsene og sørger for at tilbudene går ut i tide.",

  url: "https://www.soleklart.com",

  email: "asbjorn@sooleklart.com",
  phone: "+47 458 71 718",
  orgNr: "930 729 272",

  address: {
    /** TODO: sett riktig besøksadresse */
    street: "Storgata 1",
    postalCode: "0155",
    city: "Oslo",
    country: "Norge",
  },

  /** Åpningstid som vises ved telefonnummeret. */
  officeHours: "Man–fre 08–16",

  /** Hvor lang tid vi lover på svar. Brukes i CTA-tekstene. */
  responseTime: "innen én virkedag",
} as const;

/** Telefonnummer uten mellomrom — til `tel:`-lenker. */
export const PHONE_HREF = `tel:${SITE.phone.replace(/\s+/g, "")}`;

/** `mailto:`-lenke med ferdig utfylt emne og brødtekst. */
export function mailto(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set("body", body);
  return `mailto:${SITE.email}?${params.toString().replace(/\+/g, "%20")}`;
}

/**
 * «Bli partner»-lenken. Åpner e-postklienten med et ferdig utkast, slik at
 * bedriften bare trenger å fylle inn og sende.
 */
export const BECOME_PARTNER_MAILTO = mailto(
  "Vi ønsker å bli partner hos Soleklart",
  [
    "Hei Soleklart!",
    "",
    "Vi ønsker å høre mer om et samarbeid.",
    "",
    "Bedrift:",
    "Org.nr:",
    "Kontaktperson:",
    "Telefon:",
    "Område vi jobber i:",
    "Kort om oss:",
    "",
    "Mvh",
  ].join("\n"),
);

/**
 * Lenke privatpersoner bruker når de vil ha tilbud på solceller.
 * Partnersidene sender henvendelsen videre med bedriftsnavnet i emnefeltet.
 */
export function requestQuoteMailto(partnerName?: string): string {
  return mailto(
    partnerName
      ? `Tilbud på solceller – ${partnerName}`
      : "Jeg ønsker tilbud på solceller",
    [
      "Hei!",
      "",
      partnerName
        ? `Jeg ønsker et tilbud på solceller, gjerne fra ${partnerName}.`
        : "Jeg ønsker et tilbud på solceller.",
      "",
      "Navn:",
      "Adresse:",
      "Telefon:",
      "Type tak:",
      "Omtrentlig strømforbruk per år:",
      "",
      "Mvh",
    ].join("\n"),
  );
}
