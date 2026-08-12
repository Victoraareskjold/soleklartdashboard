"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/app/components/ds";
import type { Partner } from "@/lib/partners";
import { PartnerCard } from "./PartnerCard";

const ALL = "Hele landet";

export function PartnerDirectory({
  partners,
  regions,
}: {
  partners: Partner[];
  regions: string[];
}) {
  const [region, setRegion] = useState<string>(ALL);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return partners.filter((p) => {
      const matchesRegion =
        region === ALL || p.region === region || p.region === "Hele landet";
      if (!matchesRegion) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.region.toLowerCase().includes(q) ||
        p.cities.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [partners, region, query]);

  const chips = [ALL, ...regions.filter((r) => r !== ALL)];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chips.map((r) => {
            const active = r === region;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: 14,
                  fontWeight: "var(--weight-semibold)" as unknown as number,
                  cursor: "pointer",
                  transition: "var(--transition-base)",
                  border: `1px solid ${active ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                  background: active ? "var(--brand-primary)" : "var(--white)",
                  color: active ? "var(--white)" : "var(--text-body)",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

        <label
          style={{
            position: "relative",
            display: "block",
            minWidth: 240,
            flex: "0 1 280px",
          }}
        >
          <span className="sr-only" style={{ display: "none" }}>
            Søk etter sted eller bedrift
          </span>
          <Icon
            name="search"
            size={17}
            style={{
              position: "absolute",
              left: 14,
              top: 11,
              color: "var(--grey-400)",
            }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk på sted eller bedrift"
            aria-label="Søk på sted eller bedrift"
            style={{
              width: "100%",
              height: 40,
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--text-heading)",
              background: "var(--white)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-pill)",
              padding: "0 16px 0 40px",
              outline: "none",
            }}
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p style={{ marginTop: 48, fontSize: 17, color: "var(--text-muted)" }}>
          Vi fant ingen partnere som passer. Prøv et annet område — eller ta
          kontakt, så finner vi noen for deg.
        </p>
      ) : (
        <div className="sk-grid-3" style={{ marginTop: 40 }}>
          {filtered.map((p) => (
            <PartnerCard key={p.slug} partner={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default PartnerDirectory;
