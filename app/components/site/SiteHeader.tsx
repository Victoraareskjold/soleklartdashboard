import Link from "next/link";
import { CLIENT_ROUTES } from "@/constants/routes";
import { BECOME_PARTNER_MAILTO } from "@/constants/site";
import { Button } from "@/app/components/ds";
import { Logo } from "./Logo";

const NAV = [
  { label: "Om Soleklart", href: "/#om-soleklart" },
  { label: "Hva vi hjelper med", href: "/#hva-vi-hjelper-med" },
  { label: "Partnere", href: "/partnere" },
];

export function SiteHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="sk-container sk-header-bar"
        style={{
          height: 76,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <Logo href="/" height={28} priority />

        <nav className="sk-header-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: 15,
                color: "var(--text-body)",
                fontWeight: "var(--weight-medium)" as unknown as number,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* Skjules på mobil — «Bli partner» finnes både i hero og i footer,
              og headeren har ikke plass til begge knappene på små skjermer. */}
          <span className="sk-hide-mobile">
            <Button variant="ghost" size="sm" href={BECOME_PARTNER_MAILTO}>
              Bli partner
            </Button>
          </span>
          <Button
            size="sm"
            icon="log-in"
            iconPosition="left"
            href={CLIENT_ROUTES.AUTH}
            style={{ flexShrink: 0 }}
          >
            Logg inn
          </Button>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
