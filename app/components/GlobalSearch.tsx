"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, MapPin, Phone, Building2 } from "lucide-react";
import { useTeam } from "@/context/TeamContext";
import { getToken } from "@/lib/api";

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
    router.push(`/leads/${result.id}`);
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
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Søk på navn, adresse, telefon, e-post..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}>
              <X size={16} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 border border-gray-200 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Søker...
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Ingen resultater for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Skriv minst 2 tegn for å søke
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul>
              {results.map((result, i) => {
                const st = statusInfo(result.status);
                const isSelected = i === selectedIndex;
                return (
                  <li key={result.id}>
                    <button
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                        isSelected ? "bg-gray-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => navigate(result)}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      {/* Status dot */}
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                        style={{ background: st?.color ?? "#d1d5db" }}
                      />

                      <div className="flex-1 min-w-0">
                        {/* Name + company */}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {result.person_info || "Ukjent navn"}
                          </span>
                          {result.company && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Building2 size={11} />
                              {result.company}
                            </span>
                          )}
                        </div>

                        {/* Address */}
                        {result.address && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={11} className="flex-shrink-0" />
                            <span className="truncate">{result.address}</span>
                          </p>
                        )}

                        {/* Phone */}
                        {(result.mobile || result.phone) && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone size={11} className="flex-shrink-0" />
                            {result.mobile || result.phone}
                          </p>
                        )}
                      </div>

                      {/* Right side: status + group */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {st && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: st.color + "33",
                              color: "#374151",
                            }}
                          >
                            {st.label}
                          </span>
                        )}
                        {result.installerGroupName && (
                          <span className="text-xs text-gray-400">
                            {result.installerGroupName}
                          </span>
                        )}
                      </div>
                    </button>
                    {i < results.length - 1 && (
                      <div className="h-px bg-gray-50 mx-4" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
            <span>↑↓ naviger</span>
            <span>↵ åpne</span>
            <span>Esc lukk</span>
          </div>
        )}
      </div>
    </div>
  );
}
