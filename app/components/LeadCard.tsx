import { Lead } from "@/lib/types";
import Link from "next/link";

interface LeadCardProps {
  lead: Lead;
}

export default function LeadCard({ lead }: LeadCardProps) {
  const priorityColor = (priority: string) => {
    if (priority === "Iron") return "bg-slate-200 text-slate-800";
    if (priority === "Gold") return "bg-yellow-100 text-yellow-800";
    if (priority === "Diamond") return "bg-blue-200 text-blue-900";
    return "bg-slate-100";
  };

  return (
    <Link href={`/leads/${lead.id}`}>
      <p className="font-medium text-sm">{lead.person_info || "Uten navn"}</p>
      <p className="text-gray-500 text-xs">{lead.email || "Ingen email"}</p>
      <p
        className={`${priorityColor(
          lead.priority
        )} rounded-md font-semibold w-fit py-1 px-2 mt-4`}
      >
        {lead.priority}
      </p>
    </Link>
  );
}
