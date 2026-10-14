"use client";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { updateLead, getFullLeads, FullLead } from "@/lib/api";
import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { toast } from "react-toastify";
import LeadCard from "./LeadCard";
import { useRoles } from "@/context/RoleProvider";
import { LEAD_STATUSES } from "@/constants/leadStatuses";

// Date helper functions
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setHours(0, 0, 0, 0);
  return new Date(d.setDate(diff));
};

interface LeadsTableProps {
  leadOwner: string;
  leadCollector: string;
  searchQuery: string;
  taskDueDateFilter: string;
}

export default function LeadsTable({
  leadOwner,
  leadCollector,
  searchQuery,
  taskDueDateFilter,
}: LeadsTableProps) {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { teamRole } = useRoles();

  const [rawLeads, setRawLeads] = useState<FullLead[]>([]);
  const [leads, setLeads] = useState<FullLead[]>([]);

  useEffect(() => {
    if (!teamId || !installerGroupId || !teamRole) return;

    getFullLeads(teamId, installerGroupId, teamRole)
      .then((data) => {
        setRawLeads(data);
      })
      .catch((err) => {
        console.error("Failed to fetch full leads:", err);
      });
  }, [teamId, installerGroupId, teamRole]);

  // Effect for filtering data
  useEffect(() => {
    let filteredLeads = [...rawLeads];

    // Filter by owner and collector
    if (leadOwner || leadCollector) {
      filteredLeads = filteredLeads.filter((lead) => {
        const ownerMatch = !leadOwner || lead.assigned_to === leadOwner;
        const collectorMatch =
          !leadCollector || lead.created_by === leadCollector;
        return ownerMatch && collectorMatch;
      });
    }

    // Filter by search query
    if (searchQuery) {
      filteredLeads = filteredLeads.filter((lead) => {
        const query = searchQuery.toLowerCase();
        const searchableFields = [
          lead.person_info,
          lead.company,
          lead.address,
          lead.email,
          lead.phone,
          lead.mobile,
          lead.note,
        ];
        return searchableFields.some(
          (field) => field && field.toString().toLowerCase().includes(query),
        );
      });
    }

    // Filter by task due date
    if (taskDueDateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filteredLeads = filteredLeads.filter((lead) => {
        const leadTasks = lead.lead_tasks;

        if (taskDueDateFilter === "none") {
          return leadTasks.length === 0;
        }

        if (!leadTasks || leadTasks.length === 0) return false;

        return leadTasks.some((task) => {
          if (!task.due_date) return false;

          const dueDate = new Date(task.due_date);
          dueDate.setHours(0, 0, 0, 0);

          switch (taskDueDateFilter) {
            case "overdue":
              return dueDate < today;
            case "today":
              return dueDate.getTime() === today.getTime();
            case "this_week": {
              const startOfWeek = getStartOfWeek(now);
              const endOfWeek = new Date(startOfWeek);
              endOfWeek.setDate(startOfWeek.getDate() + 6);
              return dueDate >= startOfWeek && dueDate <= endOfWeek;
            }
            case "next_week": {
              const startOfNextWeek = getStartOfWeek(now);
              startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
              const endOfNextWeek = new Date(startOfNextWeek);
              endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
              return dueDate >= startOfNextWeek && dueDate <= endOfNextWeek;
            }
            case "this_month":
              return (
                dueDate.getFullYear() === now.getFullYear() &&
                dueDate.getMonth() === now.getMonth()
              );
            case "next_month":
              const nextMonth = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                1,
              );
              return (
                dueDate.getFullYear() === nextMonth.getFullYear() &&
                dueDate.getMonth() === nextMonth.getMonth()
              );
            case "this_year":
              return dueDate.getFullYear() === now.getFullYear();
            case "next_year":
              return dueDate.getFullYear() === now.getFullYear() + 1;
            default:
              return true;
          }
        });
      });
    }

    setLeads(filteredLeads);
  }, [rawLeads, leadOwner, leadCollector, searchQuery, taskDueDateFilter]);

  const grouped = LEAD_STATUSES.reduce(
    (acc, status) => {
      acc[status.value] = leads.filter(
        (lead) => Number(lead.status) === status.value,
      );
      return acc;
    },
    {} as Record<number, FullLead[]>,
  );

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceStatus = parseInt(source.droppableId);
    const destStatus = parseInt(destination.droppableId);

    if (sourceStatus === destStatus) return;

    const originalRawLeads = [...rawLeads];
    const updatedRawLeads = rawLeads.map((lead) =>
      lead.id === draggableId ? { ...lead, status: destStatus } : lead,
    );
    setRawLeads(updatedRawLeads);

    try {
      await updateLead(draggableId, {
        status: destStatus as FullLead["status"],
      });
    } catch (err) {
      console.error("Failed to update lead status:", err);
      toast.error("Failed to update lead status");
      setRawLeads(originalRawLeads);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: number) => {
    const originalRawLeads = [...rawLeads];
    const updatedRawLeads = rawLeads.map((l) =>
      l.id === leadId ? { ...l, status: newStatus } : l,
    );
    setRawLeads(updatedRawLeads);

    try {
      await updateLead(leadId, { status: newStatus });
      toast.success("Status oppdatert!");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke oppdatere status");
      setRawLeads(originalRawLeads);
    }
  };

  const calculateTotalForStatus = (statusLeads: FullLead[]): number => {
    return statusLeads.reduce((total, lead) => {
      if (lead.updated_price !== null && lead.updated_price !== undefined) {
        return total + Number(lead.updated_price);
      }

      if (!lead.estimates || lead.estimates.length === 0) return total;

      const latest = lead.estimates.reduce((a, b) =>
        new Date(a.created_at || 0) > new Date(b.created_at || 0) ? a : b,
      );

      if (!latest.price_data) return total;

      return total + (latest.price_data.total || 0);
    }, 0);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 2xl:grid-cols-5">
      <DragDropContext onDragEnd={onDragEnd}>
        {LEAD_STATUSES.map((status) => {
          const statusLeads = grouped[status.value] || [];
          const totalForStatus = calculateTotalForStatus(statusLeads);

          return (
            <Droppable key={status.value} droppableId={status.value.toString()}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-card border bg-gray-100/70 transition-colors ${
                    snapshot.isDraggingOver
                      ? "border-blue-300 bg-blue-50/70"
                      : "border-line"
                  }`}
                >
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <div className="flex min-h-14 items-start justify-between gap-2 px-3 pb-2 pt-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-1 size-2.5 flex-none rounded-full ring-2 ring-white"
                        style={{ backgroundColor: status.color }}
                      />
                      <h2 className="font-sans text-[13px] font-semibold leading-5 text-ink">
                        {status.label}
                      </h2>
                    </div>
                    <span className="flex-none rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600 shadow-card">
                      {statusLeads.length}
                    </span>
                  </div>
                  <div className="flex max-h-[40rem] flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 pb-2">
                    {statusLeads.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-300 py-8 text-xs text-gray-400">
                        Ingen avtaler
                      </div>
                    )}
                    {statusLeads.map((lead, index) => (
                      <Draggable
                        key={lead.id}
                        draggableId={lead.id}
                        index={index}
                      >
                        {(provided, dragSnapshot) => (
                          <div
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            ref={provided.innerRef}
                            className={`rounded-xl border bg-surface p-3 transition-shadow ${
                              dragSnapshot.isDragging
                                ? "rotate-1 border-blue-200 shadow-pop"
                                : "border-line shadow-card hover:border-gray-300 hover:shadow-md"
                            }`}
                          >
                            <LeadCard
                              lead={lead}
                              tasks={lead.lead_tasks}
                              onStatusChange={handleStatusChange}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line bg-surface/70 px-3 py-2.5">
                    <span className="text-[11px] font-medium text-muted">
                      Totalt eks. mva
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-ink">
                      {totalForStatus.toLocaleString("nb-NO", {
                        style: "currency",
                        currency: "NOK",
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </DragDropContext>
    </div>
  );
}
