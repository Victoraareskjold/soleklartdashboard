import type { Metadata } from "next";
import { SITE } from "@/constants/site";
import { SiteShell } from "@/app/components/site/SiteShell";
import { About } from "@/app/components/site/sections/About";
import { ClosingCta } from "@/app/components/site/sections/ClosingCta";
import { Hero } from "@/app/components/site/sections/Hero";
import { Partners } from "@/app/components/site/sections/Partners";
import { Services } from "@/app/components/site/sections/Services";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
};

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <About />
      <Services />
      {/* <Partners /> */}
      <ClosingCta />
    </SiteShell>
  );
}
