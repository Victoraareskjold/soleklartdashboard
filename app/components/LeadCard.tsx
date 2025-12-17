import { Lead, LeadTask } from "@/lib/types";
import Link from "next/link";

interface LeadCardProps {
  lead: Lead;
  tasks?: LeadTask[];
}

export default function LeadCard({ lead, tasks = [] }: LeadCardProps) {
  const nextTask = tasks
    .filter((t) => t.due_date)
    .sort(
      (a, b) =>
        new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
    )[0];

  let dueText = "Ingen oppgave";

  if (nextTask) {
    const now = new Date().getTime();
    const due = new Date(nextTask.due_date!).getTime();
    const diffMs = due - now;

    if (diffMs <= 0) {
      dueText = "Oppgave forfalt";
    } else if (diffMs < 1000 * 60 * 60 * 24) {
      const hours = Math.ceil(diffMs / (1000 * 60 * 60));
      dueText = `Oppgave forfaller om ${hours} time${hours > 1 ? "r" : ""}`;
    } else {
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      dueText = `Oppgave forfaller om ${days} dag${days > 1 ? "er" : ""}`;
    }
  }

  return (
    <Link href={`/leads/${lead.id}`}>
      <p className="font-bold text-blue-600 text-md border-b border-black pb-1 mb-3">
        {lead.person_info || "Ingen navn"} - {lead.address || "Ingen addresse"}
      </p>

      <div className="flex flex-row justify-between items-center">
        <div>
          <p className="text-gray-500 text-xs">
            {lead.phone && Number(lead.phone) !== 0
              ? lead.phone
              : lead.mobile && Number(lead.mobile) !== 0
              ? lead.mobile
              : "Ingen mobil eller telefon"}
          </p>
          <p className="text-gray-500 text-xs">{lead.email || "Ingen email"}</p>
        </div>
        <img
          src={`/icons/${lead.priority}.png`}
          alt={lead.priority || "Ingen prioritet"}
          className="w-6 h-6"
        />
      </div>

      <div className="flex flex-row justify-between items-center mt-4 text-sm">
        <p>{dueText}</p>
        <p className="text-nowrap">
          {lead.company || lead.role ? "🏭 Næring" : "🏠 Privat"}
        </p>
      </div>
    </Link>
  );
}
