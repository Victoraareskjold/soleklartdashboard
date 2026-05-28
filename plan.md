Plan: Verdi per trafikkilde — Admin-konsoll
Context
Admin ønsker å se total salgsverdi (kr) per trafikkilde (Facebook, Google, Organic, Cold calling), ikke bare antall salg. Det er to visninger: totalsum for alle installatører samlet, og nedbrytning per installatørfirma/team. Gjelder kun leads med SIGNED_STATUSES (18–21).

Nøkkeldata som allerede finnes:

installerBreakdown[*].sources[*].stats.signedValue — verdi per kilde per installatørgruppe finnes allerede i API-svaret
Det som mangler er én totalsum på tvers av alle grupper, tilgjengelig direkte fra backend
Endringer

1. Backend — app/api/admin/stats/route.ts
   Legg til ny aggregering valueBySource rett etter sourceDistribution-blokken (~linje 534):

const valueBySource: Record<string, { signedValue: number; signedCount: number }> = {
google: { signedValue: 0, signedCount: 0 },
facebook: { signedValue: 0, signedCount: 0 },
organic: { signedValue: 0, signedCount: 0 },
coldcall: { signedValue: 0, signedCount: 0 },
};

leads.forEach((l) => {
if (!l.status || !SIGNED_STATUSES.has(l.status)) return;
const value = (l.updated_price ?? 0) > 0 ? l.updated_price! : leadValueMap[l.id] || 0;
if (value <= 0) return;
const src = parseInboundSource(l.note) || (l.lead_source?.trim()) || "organic";
const bucket = /^cold/i.test(src) ? "coldcall" : (INBOUND_SOURCE_KEYS.has(src) ? src : "organic");
valueBySource[bucket].signedValue += value;
valueBySource[bucket].signedCount++;
});
Legg valueBySource inn i NextResponse.json({...}) svaret (~linje 760).

2. Frontend — app/(dashboard)/admin/page.tsx
   Type-oppdatering: Legg til valueBySource i AdminStats-interfacet.

Ny seksjon — plasseres etter eksisterende inbound/kilde-statistikk-seksjon:

Del A: Total oversikt (alle installatører)
Tabell/kortvisning med 4 kolonner (Facebook / Google / Organic / Cold Calling), der hver viser:

Salgsverdi i kr (formatert, f.eks. 1 250 000 kr)
Antall signerte salg
Sortert synkende på verdi
Del B: Per installatørgruppe
For hvert installerBreakdown-element — vis en rad per installatør med kildekolonner. Data hentes fra installerBreakdown[i].sources[j].stats.signedValue og .signedInPeriod som allerede returneres.

Visning: kompakt tabell, én rad per installatørfirma, kolonner = kilde (Facebook/Google/Organic/Cold calling), celler = kr X (N salg).

Kritiske filer
app/api/admin/stats/route.ts — legg til valueBySource-aggregering
app/(dashboard)/admin/page.tsx — ny UI-seksjon
Verifisering
npm run dev — åpne admin-konsollen
Verifiser at den nye seksjonen vises med riktige beløp
Sjekk at totalsummen matcher manuell sum av signerte leads per kilde
Verifiser at per-installatør-tabellen er korrekt gruppert
