import Link from "next/link";
import { CLIENT_ROUTES } from "@/constants/routes";
import { BECOME_PARTNER_MAILTO, PHONE_HREF, SITE } from "@/constants/site";
import { Logo } from "./Logo";

const linkStyle = {
  color: "var(--blue-300)",
  fontSize: 14,
  fontWeight: 400,
} as const;

const headingStyle = {
  color: "var(--white)",
  fontWeight: "var(--weight-semibold)" as unknown as number,
  fontSize: 14,
  marginBottom: 12,
} as const;

export function SiteFooter() {
  return (
    <footer
      style={{ background: "var(--surface-inverse)", padding: "56px 24px 40px" }}
    >
      <div
        className="sk-container"
        style={{
          display: "flex",
          gap: 48,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <Logo variant="white" height={26} />
          <p
            style={{
              marginTop: 16,
              color: "var(--blue-300)",
              fontSize: 15,
              maxWidth: 340,
            }}
          >
            Vi jobber med markedsføring, salg og oppfølging for solenergi- og
            elektrobedrifter i Norge.
          </p>
        </div>

        <div className="sk-footer-cols">
          <div>
            <div style={headingStyle}>Soleklart</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/#om-soleklart" style={linkStyle}>
                Om oss
              </Link>
              <Link href="/partnere" style={linkStyle}>
                Partnere
              </Link>
              <a href={BECOME_PARTNER_MAILTO} style={linkStyle}>
                Bli partner
              </a>
              <Link href={CLIENT_ROUTES.AUTH} style={linkStyle}>
                Logg inn
              </Link>
            </div>
          </div>

          <div>
            <div style={headingStyle}>Kontakt</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: "var(--blue-300)",
                fontSize: 14,
              }}
            >
              <a href={`mailto:${SITE.email}`} style={linkStyle}>
                {SITE.email}
              </a>
              <a href={PHONE_HREF} style={linkStyle}>
                {SITE.phone}
              </a>
              <span>{SITE.officeHours}</span>
              <span>Org.nr {SITE.orgNr}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="sk-container"
        style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          color: "var(--grey-400)",
          fontSize: 13,
        }}
      >
        © {new Date().getFullYear()} {SITE.legalName}
      </div>
    </footer>
  );
}

export default SiteFooter;
