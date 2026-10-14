"use client";
import { useEffect, useState } from "react";
import {
  Upload,
  Eye,
  Database,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";
import { getTeam } from "@/lib/api";
import { useTeam } from "@/context/TeamContext";
import { toast } from "react-toastify";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import { Team } from "@/lib/types";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useRouter } from "next/navigation";
import { CLIENT_ROUTES } from "@/constants/routes";

type Lead = {
  [key: string]: string;
};

export default function ImportPage() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Lead[] | null>(null);
  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    getTeam(teamId)
      .then(setTeam)
      .catch((err) => console.error("Failed to fetch team members:", err));
  }, [teamId]);

  async function handleUpload() {
    if (!file) return;
    setIsUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/coldCalling/import/preview", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setPreview(data.leads);
      toast.success("Fil lastet opp!");
    } catch {
      toast.error("Feil ved opplasting av fil");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCommit() {
    if (!preview || !selectedMember || !installerGroupId || !teamId) return;
    setIsCommitting(true);
    try {
      const res = await fetch("/api/coldCalling/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: preview,
          assignedTo: selectedMember,
          installerGroupId,
          teamId,
        }),
      });
      if (!res.ok) {
        toast.error("Error ved opprettelse av leads");
        return;
      }
      toast.success("Leads lagret!");
      setPreview(null);
      router.push(CLIENT_ROUTES.COLD_CALLING);
    } catch {
      toast.error("Feil ved lagring");
    } finally {
      setIsCommitting(false);
    }
  }

  const headers = [
    "Adresse",
    "Navn",
    "Rolle",
    "Firmanavn",
    "Org.Nr.",
    "Mobil",
    "Telefon",
  ];
  const fields = [
    "address",
    "name",
    "role",
    "company",
    "org_nr",
    "mobile",
    "phone",
  ];
  const [sliceAmount, setSliceAmount] = useState(5);

  return (
    <div className="sk-page max-w-6xl">
      {/* Header */}
      <div className="sk-page-header">
        <div>
          <p className="sk-eyebrow mb-1">Cold calling</p>
          <h1 className="sk-page-title">Importer Leads</h1>
          <p className="sk-page-subtitle">
            Last opp en Excel-fil for å importere nye leads til systemet
          </p>
        </div>
      </div>

      {/* Upload Card */}
      <div className="sk-card mb-6">
        <div className="sk-card-body space-y-5">
          {/* File Input */}
          <div>
            <label className="sk-label">Velg fil</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                if (e.target.files) setFile(e.target.files[0]);
              }}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`group flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
                file
                  ? "border-blue-300 bg-brand-soft"
                  : "border-gray-300 bg-gray-50/60 hover:border-blue-400 hover:bg-brand-soft"
              }`}
            >
              <span
                className={`flex size-11 items-center justify-center rounded-xl border bg-surface shadow-card transition-colors ${
                  file
                    ? "border-blue-200 text-brand"
                    : "border-line text-muted group-hover:text-brand"
                }`}
              >
                {file ? <FileSpreadsheet size={20} /> : <Upload size={20} />}
              </span>
              <span
                className={`text-sm font-semibold ${
                  file ? "text-ink" : "text-body group-hover:text-brand"
                }`}
              >
                {file ? file.name : "Klikk for å velge fil (.xlsx, .xls)"}
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="sk-btn sk-btn-primary"
            >
              <Eye size={16} />
              {isUploading ? "Laster..." : "Forhåndsvis"}
            </button>
          </div>
        </div>

        {/* Team Member Selector */}
        {preview && (
          <div className="border-t border-line px-5 py-4">
            <label className="sk-label">Lead-innhenter</label>
            <div className="max-w-xs">
              <TeamMemberSelector
                team={team}
                selectedMember={selectedMember}
                onSelectMember={setSelectedMember}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {preview && (
        <div className="sk-card overflow-hidden">
          <div className="sk-card-header">
            <div>
              <h2 className="sk-section-title">Forhåndsvisning</h2>
              <p className="mt-0.5 text-xs text-muted">
                Viser{" "}
                <span className="font-semibold text-ink tabular-nums">
                  {Math.min(sliceAmount, preview.length)}
                </span>{" "}
                av{" "}
                <span className="font-semibold text-ink tabular-nums">
                  {preview.length}
                </span>{" "}
                leads
              </p>
            </div>
            <span className="sk-badge sk-badge-brand">
              {preview.length} leads
            </span>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="sk-table">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, sliceAmount).map((lead, i) => (
                  <tr key={i}>
                    {fields.map((field) => (
                      <td
                        key={field}
                        className={`whitespace-nowrap ${
                          field === "name" ? "font-medium text-ink!" : ""
                        } ${
                          ["org_nr", "mobile", "phone"].includes(field)
                            ? "tabular-nums"
                            : ""
                        }`}
                      >
                        {lead[field] || (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-line bg-gray-50/60 px-5 py-4 sm:flex-row">
            <div>
              {sliceAmount < preview.length && (
                <button
                  onClick={() => setSliceAmount(sliceAmount + 5)}
                  className="sk-btn sk-btn-ghost sk-btn-sm"
                >
                  <ChevronDown size={15} />
                  Last inn flere
                </button>
              )}
            </div>

            <button
              onClick={handleCommit}
              disabled={!selectedMember || isCommitting}
              className="sk-btn sk-btn-primary"
            >
              <Database size={16} />
              {isCommitting ? "Lagrer..." : "Lagre i database"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
