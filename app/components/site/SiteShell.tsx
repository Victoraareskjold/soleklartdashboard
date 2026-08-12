import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Rammen rundt alle offentlige sider.
 *
 * `.sk-site` er det som slår på Soleklart-typografien. Klassen er scopet med
 * vilje slik at dashbordet, som bruker Tailwind, ikke arver noe herfra.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="sk-site">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export default SiteShell;
