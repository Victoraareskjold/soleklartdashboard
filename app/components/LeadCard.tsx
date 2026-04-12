/* eslint-disable @next/next/no-img-element */
import { Lead, LeadTask } from "@/lib/types";
import Link from "next/link";
import { LEAD_STATUSES } from "./LeadsTable";

interface LeadCardProps {
  lead: Lead;
  tasks?: LeadTask[];
  onStatusChange?: (leadId: string, newStatus: number) => void;
}

const getTaskToDisplay = (tasks: LeadTask[]): LeadTask | null => {
  if (!tasks || tasks.length === 0) return null;

  // Sorter oppgaver etter forfallsdato (tidligste først)
  const sortedTasks = [...tasks]
    .filter((task) => task.due_date)
    .sort(
      (a, b) =>
        new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime(),
    );

  if (sortedTasks.length === 0) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const earliestTask = sortedTasks[0];
  const earliestDueDate = new Date(earliestTask.due_date!);
  earliestDueDate.setHours(0, 0, 0, 0);

  // Hvis tidligste oppgave har forfalt og det finnes flere oppgaver, vis den neste
  if (earliestDueDate < now && sortedTasks.length > 1) {
    // Finn første oppgave som ikke har forfalt
    const nextTask = sortedTasks.find((task) => {
      const dueDate = new Date(task.due_date!);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= now;
    });

    return nextTask || earliestTask; // Fallback til tidligste hvis alle har forfalt
  }

  return earliestTask;
};

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  cold_call: {
    label: "Cold calling",
    className: "bg-blue-50 text-blue-600",
  },
  facebook: {
    label: "Facebook",
    className: "bg-indigo-50 text-indigo-600",
  },
  google: {
    label: "Google",
    className: "bg-green-50 text-green-600",
  },
  organic: {
    label: "Organic",
    className: "bg-gray-100 text-gray-500",
  },
};

function SourceBadge({ lead }: { lead: Lead }) {
  const src = lead.lead_source;
  if (!src) return null;
  const cfg = SOURCE_CONFIG[src];
  const label = cfg?.label ?? src;
  const className = cfg?.className ?? "bg-gray-100 text-gray-500";
  const personName = lead.assigned_user?.name;
  const displayLabel =
    src === "cold_call" && personName ? `Cold calling · ${personName}` : label;
  return (
    <span
      className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${className}`}
    >
      {displayLabel}
    </span>
  );
}

export default function LeadCard({
  lead,
  tasks = [],
  onStatusChange,
}: LeadCardProps) {
  const nextTask = getTaskToDisplay(tasks);

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
    <div className="relative bg-white p-0 rounded">
      <select
        className="absolute top-0 right-0 border rounded p-1 text-sm w-18"
        value=""
        onChange={(e) => {
          const newStatus = Number(e.target.value);
          if (!isNaN(newStatus)) {
            onStatusChange?.(lead.id, newStatus);
            e.currentTarget.value = "";
          }
        }}
      >
        <option value="" disabled>
          Flytt
        </option>
        {LEAD_STATUSES.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>

      <Link href={`/leads/${lead.id}`}>
        <div className="pt-7 pb-1 mb-3 border-b border-black flex items-start justify-between gap-2">
          <p className="font-bold text-blue-600 text-md">
            {lead.company || lead.person_info || "Mangler navn"} -{" "}
            {lead.address || "Ingen addresse"}
          </p>
          <SourceBadge lead={lead} />
        </div>

        <div className="flex flex-row justify-between items-center">
          <div>
            <p className="text-gray-500 text-xs">
              {lead.phone && Number(lead.phone) !== 0
                ? lead.phone
                : lead.mobile && Number(lead.mobile) !== 0
                  ? lead.mobile
                  : "Ingen mobil eller telefon"}
            </p>
            <p className="text-gray-500 text-xs">
              {lead.email || "Ingen email"}
            </p>
          </div>
          <img
            src={`/icons/${lead.priority}.png`}
            alt={lead.priority || "Ingen prioritet"}
            className="w-6 h-6"
          />
        </div>

        <div className="flex flex-row justify-between items-center mt-4 text-sm">
          <div className="flex flex-row gap-2 items-center">
            <p>{dueText}</p>
            {dueText === "Oppgave forfalt" && (
              <img src="/icons/danger.png" alt="danger icon" />
            )}
            {dueText === "Ingen oppgave" && (
              <img src="/icons/danger.png" alt="danger icon" />
            )}
          </div>
          <p className="text-nowrap">
            {lead.company || lead.role ? "🏭 Næring" : "🏠 Privat"}
          </p>
        </div>
      </Link>
    </div>
  );
}
