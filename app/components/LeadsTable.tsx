"use client";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import {
  getLeads,
  getLeadTasks,
  updateLead,
  getEstimatesByLeadId,
} from "@/lib/api";
import { Lead, LeadTask, Estimate } from "@/lib/types";
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

// Date helper functions
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setHours(0, 0, 0, 0);
  return new Date(d.setDate(diff));
};

export const LEAD_STATUSES = [
  { value: 7, label: "Oppfølging 1", color: "#FBF586" },
  { value: 8, label: "Oppfølging 2", color: "#FBF586" },
  { value: 9, label: "Oppfølging 3", color: "#FBF586" },
  { value: 10, label: "Oppfølging 4", color: "#FBF586" },
  { value: 11, label: "Nyhetsbrev (Langsiktig Nuturing)", color: "#ECE171" },
  { value: 12, label: "Privatkunder (Dialog pågår)", color: "#DAFFB7" },
  { value: 13, label: "Næringskunder (Dialog pågår)", color: "#DAFFB7" },
  { value: 14, label: "Venter på befaring", color: "#DAFFB7" },
  { value: 15, label: "Tilleggsinfo / Korrigering", color: "#DAFFB7" },
  { value: 16, label: "Ikke interessert", color: "#FF7979" },
  { value: 17, label: "Venter på signering", color: "#A3FFA3" },
  { value: 18, label: "Salg Fullført & Avtale Signert", color: "#6DFF68" },
  { value: 19, label: "Planlagt Installasjon", color: "#6DFF68" },
  { value: 20, label: "Anlegg Ferdigmontert", color: "#08FF00" },
  { value: 21, label: "Kommisjon Utbetalt", color: "#08FF00" },
];

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

  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); // Displayed leads
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [estimates, setEstimates] = useState<Record<string, Estimate[]>>({});

  // Effect for fetching data
  useEffect(() => {
    if (!teamId || !installerGroupId || !teamRole) return;

    getLeads(teamId, installerGroupId, teamRole)
      .then((allLeads) => {
        setRawLeads(allLeads);
        const taskPromises = allLeads.map((lead) =>
          getLeadTasks(lead.id).catch((err) => {
            console.error(`Failed to fetch tasks for lead ${lead.id}:`, err);
            return [];
          })
        );
        const estimatePromises = allLeads.map((lead) =>
          getEstimatesByLeadId(lead.id).catch((err) => {
            console.error(
              `Failed to fetch estimates for lead ${lead.id}:`,
              err
            );
            return [];
          })
        );

        return Promise.all([
          Promise.all(taskPromises),
          Promise.all(estimatePromises),
        ]);
      })
      .then(([allTasksArrays, allEstimatesArrays]) => {
        setTasks(
          allTasksArrays
            .flat()
            .filter(
              (item): item is LeadTask => "due_date" in item && "title" in item
            )
        );
        const estimatesByLead = allEstimatesArrays.reduce(
          (acc, leadEstimates) => {
            if (leadEstimates.length > 0) {
              acc[leadEstimates[0].lead_id] = leadEstimates;
            }
            return acc;
          },
          {} as Record<string, Estimate[]>
        );
        setEstimates(estimatesByLead);
      })
      .catch((err) => console.error("Failed to fetch leads or tasks:", err));
  }, [installerGroupId, teamId, teamRole]);

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
          (field) => field && field.toString().toLowerCase().includes(query)
        );
      });
    }

    // Filter by task due date
    if (taskDueDateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filteredLeads = filteredLeads.filter((lead) => {
        const leadTasks = tasks.filter((t) => t.lead_id === lead.id);
        if (leadTasks.length === 0) return false;

        return leadTasks.some((task) => {
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
                1
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
  }, [
    rawLeads,
    tasks,
    leadOwner,
    leadCollector,
    searchQuery,
    taskDueDateFilter,
  ]);

  const grouped = LEAD_STATUSES.reduce((acc, status) => {
    acc[status.value] = leads.filter((lead) => lead.status === status.value);
    return acc;
  }, {} as Record<number, Lead[]>);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceStatus = parseInt(source.droppableId);
    const destStatus = parseInt(destination.droppableId);

    if (sourceStatus === destStatus) return;

    const originalRawLeads = [...rawLeads];
    const updatedRawLeads = rawLeads.map((lead) =>
      lead.id === draggableId ? { ...lead, status: destStatus } : lead
    );
    setRawLeads(updatedRawLeads);

    try {
      await updateLead(draggableId, { status: destStatus as Lead["status"] });
    } catch (err) {
      console.error("Failed to update lead status:", err);
      toast.error("Failed to update lead status");
      setRawLeads(originalRawLeads);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: number) => {
    const originalRawLeads = [...rawLeads];
    const updatedRawLeads = rawLeads.map((l) =>
      l.id === leadId ? { ...l, status: newStatus } : l
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

  const calculateTotalForStatus = (statusLeads: Lead[]): number => {
    return statusLeads.reduce((total, lead) => {
      const leadEstimates = estimates[lead.id];
      if (!leadEstimates || leadEstimates.length === 0) {
        return total;
      }

      const latestEstimate = leadEstimates.reduce((latest, current) => {
        const latestDate = latest.created_at
          ? new Date(latest.created_at)
          : new Date(0);
        const currentDate = current.created_at
          ? new Date(current.created_at)
          : new Date(0);
        return currentDate > latestDate ? current : latest;
      });

      if (latestEstimate?.price_data) {
        const price =
          lead.company && lead.company !== ""
            ? latestEstimate.price_data.total
            : latestEstimate.price_data["total inkl. alt"];
        return total + (price || 0);
      }

      return total;
    }, 0);
  };

  return (
    <div className="flex gap-x-1 gap-y-12 grid grid-cols-5 p-4">
      <DragDropContext onDragEnd={onDragEnd}>
        {LEAD_STATUSES.map((status) => {
          const statusLeads = grouped[status.value] || [];
          const totalForStatus = calculateTotalForStatus(statusLeads);

          return (
            <Droppable key={status.value} droppableId={status.value.toString()}>
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="bg-gray-100 min-w-[250px] min-h-164 border flex flex-col justify-between"
                >
                  <div
                    style={{ backgroundColor: status.color }}
                    className="p-2 border-b flex items-center justify-between min-h-15"
                  >
                    <h2 className="font-semibold text-sm">{status.label}</h2>
                    <h2 className="font-semibold text-sm">
                      ({statusLeads.length}){" "}
                    </h2>
                  </div>
                  <div className="flex-1 p-2">
                    {statusLeads.map((lead, index) => (
                      <Draggable
                        key={lead.id}
                        draggableId={lead.id}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            ref={provided.innerRef}
                            className="bg-white rounded shadow p-3 mb-2"
                          >
                            <LeadCard
                              lead={lead}
                              tasks={tasks.filter((t) => t.lead_id === lead.id)}
                              onStatusChange={handleStatusChange}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                  <div className="p-2 border-t">
                    <h2 className="font-bold text-sm text-center">
                      Totalt:{" "}
                      {totalForStatus.toLocaleString("nb-NO", {
                        style: "currency",
                        currency: "NOK",
                      })}
                    </h2>
                  </div>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          );
        })}
      </DragDropContext>
    </div>
  );
}
