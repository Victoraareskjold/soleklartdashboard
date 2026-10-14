"use client";

import { useEffect, useState } from "react";
import {
  getEstimatesByLeadId,
  getLeadTasks,
  getLeadNotes,
  getStoredLeadEmails,
  getTeam,
} from "@/lib/api";
import { BarChart, FileText, ListTodo, Loader2, Mail } from "lucide-react";
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
              icon: <BarChart className="h-4 w-4 text-amber-600" />,
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
              icon: <ListTodo className="h-4 w-4 text-violet-600" />,
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
              icon: <FileText className="h-4 w-4 text-emerald-600" />,
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
                icon: <Mail className="h-4 w-4 text-brand" />,
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
    return (
      <div className="sk-card flex items-center justify-center gap-2 p-10 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        Laster aktivitet...
      </div>
    );
  }

  const iconBg: Record<Activity["type"], string> = {
    estimate: "bg-amber-50 ring-amber-100",
    task: "bg-violet-50 ring-violet-100",
    note: "bg-emerald-50 ring-emerald-100",
    email: "bg-blue-50 ring-blue-100",
  };

  return (
    <div className="sk-card">
      <div className="sk-card-header">
        <h2 className="sk-section-title">Nylig aktivitet</h2>
        {activities.length > 0 && (
          <span className="sk-badge sk-badge-neutral">{activities.length}</span>
        )}
      </div>
      <div className="sk-card-body">
        {activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Ingen nylig aktivitet.
          </p>
        ) : (
          <ul className="relative">
            {activities.map((activity, index) => (
              <li key={index} className="relative flex items-start gap-4 pb-6 last:pb-0">
                {index < activities.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-4 top-9 -bottom-0 w-px -translate-x-1/2 bg-line"
                  />
                )}
                <div
                  className={`relative z-[1] flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${iconBg[activity.type]}`}
                >
                  {activity.icon}
                </div>
                <div className="min-w-0 flex-grow pt-1">
                  <p className="text-sm leading-relaxed text-body [&_.font-semibold]:text-ink">
                    {activity.content}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted">
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
    </div>
  );
}
