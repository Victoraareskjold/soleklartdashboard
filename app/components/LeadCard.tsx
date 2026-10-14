/* eslint-disable @next/next/no-img-element */
import { LEAD_STATUSES } from "@/constants/leadStatuses";
import { CLIENT_ROUTES } from "@/constants/routes";
import { Lead, LeadTask } from "@/lib/types";
import Link from "next/link";
import {
  AlertTriangleIcon,
  Building2Icon,
  ClockIcon,
  HomeIcon,
  MailIcon,
  PhoneIcon,
} from "lucide-react";

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
  coldcall: {
    label: "Cold calling",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  facebook: {
    label: "Facebook",
    className: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  google: {
    label: "Google",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  organic: {
    label: "Organic",
    className: "bg-gray-100 text-gray-600 ring-gray-200",
  },
};

function SourceBadge({ lead }: { lead: Lead }) {
  const src = lead.lead_source;
  if (!src) return null;
  const cfg = SOURCE_CONFIG[src];
  const label = cfg?.label ?? src;
  const className = cfg?.className ?? "bg-gray-100 text-gray-600 ring-gray-200";
  const personName = lead.assigned_user?.name;
  const displayLabel =
    src === "coldcall" && personName ? `Cold calling · ${personName}` : label;
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${className}`}
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

  const isOverdue = dueText === "Oppgave forfalt";
  const hasNoTask = dueText === "Ingen oppgave";
  const isBusiness = Boolean(lead.company || lead.role);
  const contactPhone =
    lead.phone && Number(lead.phone) !== 0
      ? lead.phone
      : lead.mobile && Number(lead.mobile) !== 0
        ? lead.mobile
        : null;

  return (
    <div className="relative">
      <select
        className="absolute right-0 top-0 h-6 w-[4.5rem] cursor-pointer rounded-md border border-line bg-gray-50 pl-1.5 text-[11px] font-medium text-gray-600 hover:border-gray-300"
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

      <Link href={`${CLIENT_ROUTES.LEADS}/${lead.id}`} className="group block">
        <div className="flex items-start gap-2 pr-20">
          <img
            src={`/icons/${lead.priority}.png`}
            alt={lead.priority || "Ingen prioritet"}
            title={lead.priority || "Ingen prioritet"}
            className="mt-0.5 size-5 flex-none"
          />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold leading-5 text-ink group-hover:text-brand">
              {lead.company || lead.person_info || "Mangler navn"}
            </p>
            <p className="truncate text-xs text-muted">
              {lead.address || "Ingen addresse"}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <SourceBadge lead={lead} />
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
            {isBusiness ? (
              <Building2Icon size={11} />
            ) : (
              <HomeIcon size={11} />
            )}
            {isBusiness ? "Næring" : "Privat"}
          </span>
        </div>

        <div className="mt-2.5 space-y-1 text-xs text-gray-500">
          <p className="flex items-center gap-1.5 truncate">
            <PhoneIcon size={12} className="flex-none text-gray-400" />
            <span className="truncate">
              {contactPhone ?? "Ingen mobil eller telefon"}
            </span>
          </p>
          <p className="flex items-center gap-1.5">
            <MailIcon size={12} className="flex-none text-gray-400" />
            <span className="truncate">{lead.email || "Ingen email"}</span>
          </p>
        </div>

        <div
          className={`mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
            isOverdue
              ? "bg-red-50 text-red-700"
              : hasNoTask
                ? "bg-amber-50 text-amber-700"
                : "bg-gray-50 text-gray-600"
          }`}
        >
          {isOverdue || hasNoTask ? (
            <AlertTriangleIcon size={12} className="flex-none" />
          ) : (
            <ClockIcon size={12} className="flex-none" />
          )}
          {dueText}
        </div>
      </Link>
    </div>
  );
}
