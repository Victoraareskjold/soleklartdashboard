"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  SearchX,
  X,
  MapPin,
  Phone,
  Building2,
  UserRound,
  Loader2,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
} from "lucide-react";
import { useTeam } from "@/context/TeamContext";
import { getToken } from "@/lib/api";
import { CLIENT_ROUTES } from "@/constants/routes";

const ALL_STATUSES: Record<number, { label: string; color: string }> = {
  1: { label: "Annet", color: "#989898" },
  2: { label: "Ring opp", color: "#FFDB59" },
  3: { label: "Ikke interessert", color: "#626262" },
  4: { label: "Ikke svart - ring igjen", color: "#FF5959" },
  5: { label: "Vil ha tilbud", color: "#69FF59" },
  7: { label: "Oppfølging 1", color: "#FBF586" },
  8: { label: "Oppfølging 2", color: "#FBF586" },
  9: { label: "Oppfølging 3", color: "#FBF586" },
  10: { label: "Oppfølging 4", color: "#FBF586" },
  11: { label: "Nyhetsbrev", color: "#ECE171" },
  12: { label: "Privatkunder (dialog)", color: "#DAFFB7" },
  13: { label: "Næringskunder (dialog)", color: "#DAFFB7" },
  14: { label: "Venter på befaring", color: "#DAFFB7" },
  15: { label: "Tilleggsinfo / Korrigering", color: "#DAFFB7" },
  16: { label: "Ikke interessert", color: "#FF7979" },
  17: { label: "Venter på signering", color: "#A3FFA3" },
  18: { label: "Salg Fullført & Signert", color: "#6DFF68" },
  19: { label: "Planlagt Installasjon", color: "#6DFF68" },
  20: { label: "Anlegg Ferdigmontert", color: "#08FF00" },
  21: { label: "Kommisjon Utbetalt", color: "#08FF00" },
  22: { label: "Dobbel ringt, ingen svar", color: "#C50003" },
};

interface SearchResult {
  id: string;
  person_info: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  company: string | null;
  status: number | null;
  updated_price: number | null;
  installerGroupName: string | null;
}

interface GlobalSearchProps {
  onClose: () => void;
}

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const { teamId } = useTeam();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const search = useCallback(
    async (q: string) => {
      if (!teamId || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/admin/search?teamId=${teamId}&q=${encodeURIComponent(q)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [teamId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const navigate = (result: SearchResult) => {
    router.push(`${CLIENT_ROUTES.LEADS}/${result.id}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigate(results[selectedIndex]);
    }
  };

  const statusInfo = (status: number | null) =>
    status ? ALL_STATUSES[status] : null;

  return (
    <div
      className="sk-overlay z-[100] items-start pt-[12vh]"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="sk-modal flex max-w-xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-line px-5">
          {loading ? (
            <Loader2 size={20} className="shrink-0 animate-spin text-brand" />
          ) : (
            <Search size={20} className="shrink-0 text-muted" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Søk på navn, adresse, telefon, e-post..."
            className="h-14 flex-1 !rounded-none !border-0 !bg-transparent text-base text-ink !shadow-none outline-none placeholder:text-gray-400"
          />
          {query && (
            <button
              className="sk-icon-btn size-7"
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            >
              <X size={16} />
            </button>
          )}
          <kbd className="sk-kbd hidden sm:inline-flex">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" />
              Søker...
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <SearchX size={18} />
              </span>
              Ingen resultater for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Search size={18} />
              </span>
              Skriv minst 2 tegn for å søke
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
                <span className="sk-eyebrow">Leads</span>
                <span className="text-[11px] font-medium text-muted tabular-nums">
                  {results.length}
                </span>
              </div>
              <ul className="space-y-0.5">
                {results.map((result, i) => {
                  const st = statusInfo(result.status);
                  const isSelected = i === selectedIndex;
                  return (
                    <li key={result.id}>
                      <button
                        className={`group relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-brand-soft ring-1 ring-blue-100 ring-inset"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => navigate(result)}
                        onMouseEnter={() => setSelectedIndex(i)}
                      >
                        {/* Ikon med statusprikk */}
                        <span
                          className={`relative mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                            isSelected
                              ? "border-blue-200 bg-white text-brand"
                              : "border-line bg-gray-50 text-muted"
                          }`}
                        >
                          {result.company ? (
                            <Building2 size={16} />
                          ) : (
                            <UserRound size={16} />
                          )}
                          <span
                            className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white"
                            style={{ background: st?.color ?? "#d1d5db" }}
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          {/* Name + company */}
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="truncate text-sm font-semibold text-ink">
                              {result.person_info || "Ukjent navn"}
                            </span>
                            {result.company && (
                              <span className="flex items-center gap-1 text-xs text-muted">
                                <Building2 size={11} />
                                {result.company}
                              </span>
                            )}
                          </div>

                          {/* Address */}
                          {result.address && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                              <MapPin size={11} className="shrink-0" />
                              <span className="truncate">{result.address}</span>
                            </p>
                          )}

                          {/* Phone */}
                          {(result.mobile || result.phone) && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted tabular-nums">
                              <Phone size={11} className="shrink-0" />
                              {result.mobile || result.phone}
                            </p>
                          )}
                        </div>

                        {/* Right side: status + group */}
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {st && (
                            <span
                              className="sk-badge text-gray-700"
                              style={{ background: st.color + "33" }}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ background: st.color }}
                              />
                              {st.label}
                            </span>
                          )}
                          {result.installerGroupName && (
                            <span className="text-[11px] text-muted">
                              {result.installerGroupName}
                            </span>
                          )}
                        </div>

                        <CornerDownLeft
                          size={14}
                          className={`mt-1 shrink-0 text-brand transition-opacity ${
                            isSelected ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-line bg-gray-50/80 px-4 py-2.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <kbd className="sk-kbd"><ArrowUp size={10} /></kbd>
            <kbd className="sk-kbd"><ArrowDown size={10} /></kbd>
            naviger
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="sk-kbd"><CornerDownLeft size={10} /></kbd>
            åpne
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="sk-kbd">Esc</kbd>
            lukk
          </span>
        </div>
      </div>
    </div>
  );
}
