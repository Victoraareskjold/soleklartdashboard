"use client";
import { useEffect, useState } from "react";
import { Upload, Eye, Database, ChevronDown } from "lucide-react";
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

  const headers = ["Adresse", "Navn", "Rolle", "Firmanavn", "Mobil", "Telefon"];
  const fields = ["address", "name", "role", "company", "mobile", "phone"];
  const [sliceAmount, setSliceAmount] = useState(5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            Importer Leads
          </h1>
          <p className="text-slate-600">
            Last opp en Excel-fil for å importere nye leads til systemet
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="space-y-6">
            {/* File Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Velg fil
              </label>
              <div className="relative">
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
                  className="flex items-center justify-center w-full px-6 py-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer group"
                >
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500 mr-3" />
                  <span className="text-slate-600 group-hover:text-blue-600 font-medium">
                    {file ? file.name : "Klikk for å velge fil (.xlsx, .xls)"}
                  </span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed"
              >
                <Eye className="w-5 h-5" />
                {isUploading ? "Laster..." : "Forhåndsvis"}
              </button>
            </div>

            {/* Team Member Selector */}
            {preview && (
              <div className="pt-4 border-t border-slate-200">
                <TeamMemberSelector
                  team={team}
                  selectedMember={selectedMember}
                  onSelectMember={setSelectedMember}
                />
              </div>
            )}
          </div>
        </div>

        {/* Preview Table */}
        {preview && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">
                Forhåndsvisning
              </h2>
              <p className="text-slate-600 mt-1">
                Viser {Math.min(sliceAmount, preview.length)} av{" "}
                {preview.length} leads
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      {headers.map((header, index) => (
                        <th
                          key={index}
                          className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {preview.slice(0, sliceAmount).map((lead, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50 transition-colors duration-150"
                      >
                        {fields.map((field) => (
                          <td
                            key={field}
                            className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap"
                          >
                            {lead[field] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
              {sliceAmount < preview.length && (
                <button
                  onClick={() => setSliceAmount(sliceAmount + 5)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
                >
                  <ChevronDown className="w-5 h-5" />
                  Last inn flere
                </button>
              )}

              <button
                onClick={handleCommit}
                disabled={!selectedMember || isCommitting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed"
              >
                <Database className="w-5 h-5" />
                {isCommitting ? "Lagrer..." : "Lagre i database"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
