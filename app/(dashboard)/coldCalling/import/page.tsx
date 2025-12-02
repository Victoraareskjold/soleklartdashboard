"use client";
import { useEffect, useState } from "react";
import { getTeam } from "@/lib/api";
import { useTeam } from "@/context/TeamContext";
import { toast } from "react-toastify";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import { Team } from "@/lib/types";

type Lead = {
  [key: string]: string;
};

export default function ImportPage() {
  const { teamId } = useTeam();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Lead[] | null>(null);

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId)
      .then(setTeam)
      .catch((err) => console.error("Failed to fetch team members:", err));
  }, [teamId]);

  async function handleUpload() {
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/coldCalling/import/preview", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    setPreview(data.leads);
  }

  async function handleCommit() {
    if (!preview) return;

    /* await fetch("/api/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads: preview, assignedTo: selectedMember }),
    }); */

    toast.success("Leads lagret!");
    setPreview(null);
  }

  const headers = ["Adresse", "Navn", "Rolle", "Firmanavn", "Mobil", "Telefon"];
  const fields = ["address", "name", "role", "company", "mobile", "phone"];
  const [sliceAmount, setSliceAmount] = useState(5);

  return (
    <div className="flex flex-col mx-auto justify-center h-screen">
      <h1>Last opp filene dine</h1>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          if (e.target.files) setFile(e.target.files[0]);
        }}
      />
      <button onClick={handleUpload}>Forhåndsvis</button>

      <TeamMemberSelector
        team={team}
        selectedMember={selectedMember}
        onSelectMember={setSelectedMember}
      />

      {preview && (
        <>
          <div className="max-h-128 overflow-scroll border-slate-400 border-2">
            <table className="border-collapse w-full">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th className="border p-2 w-1/6" key={index}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, sliceAmount).map((lead, i) => (
                  <tr key={i}>
                    {fields.map((field) => (
                      <td className="border p-1 w-1/6" key={field}>
                        {lead[field]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => setSliceAmount(sliceAmount + 5)}>
            Last inn flere
          </button>

          <button onClick={handleCommit}>Lagre i DB</button>
        </>
      )}
    </div>
  );
}
