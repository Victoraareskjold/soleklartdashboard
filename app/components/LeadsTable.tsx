"use client";

import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { getLeads, updateLead } from "@/lib/api";
import { Lead, LEAD_STATUSES } from "@/lib/types";
import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { toast } from "react-toastify";

export default function LeadsTable() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!teamId || !installerGroupId) return;

    getLeads(teamId, installerGroupId)
      .then(setLeads)
      .catch((err) => console.error("Failed to fetch leads:", err));
  }, [installerGroupId, teamId]);

  const grouped = LEAD_STATUSES.reduce((acc, status) => {
    acc[status] = leads.filter((lead) => lead.status === status);
    return acc;
  }, {} as Record<string, Lead[]>);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    if (sourceStatus !== destStatus) {
      const updatedLeads = leads.map((lead) =>
        lead.id === draggableId
          ? { ...lead, status: destStatus as Lead["status"] }
          : lead
      );
      setLeads(updatedLeads);

      try {
        await updateLead(draggableId, { status: destStatus as Lead["status"] });
      } catch (err) {
        console.error("Failed to update lead status:", err);
        toast.error("Failed to update lead statuss");
      }
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      <DragDropContext onDragEnd={onDragEnd}>
        {LEAD_STATUSES.map((status) => (
          <Droppable key={status} droppableId={status}>
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="bg-gray-100 rounded-md p-3 min-w-[250px]"
              >
                <h2 className="font-semibold text-gray-700 mb-3 uppercase text-sm">
                  {status}
                </h2>
                {grouped[status]?.map((lead, index) => (
                  <Draggable key={lead.id} draggableId={lead.id} index={index}>
                    {(provided) => (
                      <div
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        ref={provided.innerRef}
                        className="bg-white rounded shadow p-3 mb-2"
                      >
                        <p className="font-medium text-sm">
                          {lead.name ?? "Uten navn"}
                        </p>
                        {lead.email && (
                          <p className="text-gray-500 text-xs">{lead.email}</p>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </DragDropContext>
    </div>
  );
}
