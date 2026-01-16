"use client";

import { useEffect, useState } from "react";
import {
  getEstimatesByLeadId,
  getLeadTasks,
  getLeadNotes,
  getStoredLeadEmails,
  getTeam,
} from "@/lib/api";
import { BarChart, FileText, ListTodo, Mail } from "lucide-react";
import React from "react";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { Note, LeadTask, EmailContent, Team } from "@/lib/types";
import { useTeam } from "@/context/TeamContext";

interface Activity {
  type: "estimate" | "task" | "note" | "email";
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
  const { installerGroupId } = useInstallerGroup();
  const { teamId } = useTeam();
  const [team, setTeam] = useState<Team | undefined>();

  useEffect(() => {
    if (!teamId) return;
    getTeam(teamId).then(setTeam);
  }, [teamId]);

  useEffect(() => {
    if (!leadId || !installerGroupId || !team) return;

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const [estimates, tasks, notes, emailsResponse] = await Promise.all([
          getEstimatesByLeadId(leadId),
          getLeadTasks(leadId),
          getLeadNotes(leadId),
          getStoredLeadEmails(leadId, installerGroupId),
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

        tasks?.forEach((t: LeadTask) => {
          if (t.created_at) {
            const assignee = team.members?.find(
              (m) => m.user_id === t.assigned_to
            );
            allActivities.push({
              type: "task",
              date: new Date(t.created_at),
              content: (
                <>
                  Ny oppgave: <span className="font-semibold">{t.title}</span>
                  {assignee && (
                    <>
                      {" "}
                      tildelt til{" "}
                      <span className="font-semibold">{assignee.name}</span>
                    </>
                  )}
                </>
              ),
              icon: <ListTodo className="h-4 w-4 text-gray-500" />,
            });
          }
        });

        notes?.forEach((n: Note) => {
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
                  {n.content && (
                    <span className="italic">
                      : &quot;{n.content.substring(0, 70)}
                      {n.content.length > 70 && "..."}&quot;
                    </span>
                  )}
                </>
              ),
              icon: <FileText className="h-4 w-4 text-gray-500" />,
            });
          }
        });

        if (emailsResponse.success) {
          emailsResponse.emails.forEach((email: EmailContent) => {
            if (email.created_at) {
              allActivities.push({
                type: "email",
                date: new Date(email.created_at),
                content: (
                  <>
                    E-post sendt til{" "}
                    <span className="font-semibold">
                      {email.to_addresses.join(", ")}
                    </span>{" "}
                    med emne:{" "}
                    <span className="font-semibold">{email.subject}</span>
                  </>
                ),
                icon: <Mail className="h-4 w-4 text-gray-500" />,
              });
            }
          });
        }

        allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
        setActivities(allActivities);
      } catch (error) {
        console.error("Failed to fetch activities", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [leadId, installerGroupId, team]);

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
