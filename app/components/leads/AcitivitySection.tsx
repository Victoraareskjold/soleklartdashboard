"use client";

import { useEffect, useState } from "react";
import { getEstimatesByLeadId, getLeadTasks, getLeadNotes } from "@/lib/api";
import { BarChart, FileText, ListTodo } from "lucide-react";
import React from "react";

interface Activity {
  type: "estimate" | "task" | "note";
  date: Date;
  content: React.ReactNode;
  icon: React.ReactNode;
}

interface AcitivitySectionProps {
  leadId: string;
}

export default function AcitivitySection({ leadId }: AcitivitySectionProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) return;

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const [estimates, tasks, notes] = await Promise.all([
          getEstimatesByLeadId(leadId),
          getLeadTasks(leadId),
          getLeadNotes(leadId),
        ]);

        const allActivities: Activity[] = [];

        estimates?.forEach((e) => {
          if (e.created_at) {
            allActivities.push({
              type: "estimate",
              date: new Date(e.created_at),
              content: "Nytt estimat ble opprettet.",
              icon: <BarChart className="h-4 w-4 text-gray-500" />,
            });
          }
        });

        tasks?.forEach((t) => {
          if (t.created_at) {
            allActivities.push({
              type: "task",
              date: new Date(t.created_at),
              content: (
                <>
                  Ny oppgave: <span className="font-semibold">{t.title}</span>
                </>
              ),
              icon: <ListTodo className="h-4 w-4 text-gray-500" />,
            });
          }
        });

        notes?.forEach((n) => {
          if (n.created_at && n.source === "note") {
            allActivities.push({
              type: "note",
              date: new Date(n.created_at),
              content: (
                <>
                  Ny merknad fra{" "}
                  <span className="font-semibold">
                    {n.user?.name || "Ukjent"}
                  </span>
                </>
              ),
              icon: <FileText className="h-4 w-4 text-gray-500" />,
            });
          }
        });

        allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
        setActivities(allActivities);
      } catch (error) {
        console.error("Failed to fetch activities", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [leadId]);

  if (loading) {
    return <div>Laster aktivitet...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-5">Nylig aktivitet</h2>
      {activities.length === 0 ? (
        <p className="text-gray-500">Ingen nylig aktivitet.</p>
      ) : (
        <ul className="space-y-8">
          {activities.map((activity, index) => (
            <li key={index} className="flex items-start space-x-4">
              <div className="flex-shrink-0 mt-1.5 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                {activity.icon}
              </div>
              <div className="flex-grow">
                <p className="text-sm text-gray-800">{activity.content}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activity.date.toLocaleString("nb-NO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
