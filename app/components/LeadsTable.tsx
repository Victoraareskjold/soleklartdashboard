"use client";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { getLeads, updateLead } from "@/lib/api";
import { Lead } from "@/lib/types";
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
  selectedMember: string;
}

export default function LeadsTable({ selectedMember }: LeadsTableProps) {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { teamRole } = useRoles();

  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!teamId || !installerGroupId || !teamRole) return;

    getLeads(teamId, installerGroupId, teamRole)
      .then((allLeads) => {
        if (selectedMember === "" || selectedMember === null) {
          setLeads(allLeads);
        } else {
          setLeads(
            allLeads.filter((lead) => lead.assigned_to === selectedMember)
          );
        }
      })
      .catch((err) => console.error("Failed to fetch leads:", err));
  }, [installerGroupId, teamId, teamRole, selectedMember]);

  const grouped = LEAD_STATUSES.reduce((acc, status) => {
    acc[status.value] = leads.filter((lead) => lead.status === status.value);
    return acc;
  }, {} as Record<number, Lead[]>);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceStatus = parseInt(source.droppableId);
    const destStatus = parseInt(destination.droppableId);

    // Kun oppdater hvis status faktisk endres
    if (sourceStatus === destStatus) return;

    // Oppdater lokal state optimistisk
    const updatedLeads = leads.map((lead) =>
      lead.id === draggableId ? { ...lead, status: destStatus } : lead
    );
    setLeads(updatedLeads);

    // Oppdater DB
    try {
      await updateLead(draggableId, { status: destStatus as Lead["status"] });
    } catch (err) {
      console.error("Failed to update lead status:", err);
      toast.error("Failed to update lead status");

      // Revert hvis DB feiler
      setLeads(leads);
    }
  };

  return (
    <div className="flex gap-x-1 gap-y-12 grid grid-cols-5 p-4">
      <DragDropContext onDragEnd={onDragEnd}>
        {LEAD_STATUSES.map((status) => (
          <Droppable key={status.value} droppableId={status.value.toString()}>
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="bg-gray-100 min-w-[250px] min-h-124 border flex flex-col justify-between"
              >
                <div
                  style={{ backgroundColor: status.color }}
                  className="p-2 border-b flex items-center justify-between min-h-15"
                >
                  <h2 className="font-semibold text-sm">{status.label}</h2>
                  <h2 className="font-semibold text-sm">
                    ({grouped[status.value]?.length || 0}){" "}
                  </h2>
                </div>
                <div className="flex-1 p-2">
                  {grouped[status.value]?.map((lead, index) => (
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
                          <LeadCard lead={lead} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
                <div className="p-2 border-t">
                  <h2 className="font-bold text-sm text-center">
                    Totalt: 14 123412 Kr
                  </h2>
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </DragDropContext>
    </div>
  );
}
