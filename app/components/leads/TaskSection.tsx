"use client";
import { Lead, LeadTask, Team } from "@/lib/types";
import { CLIENT_ROUTES } from "@/constants/routes";
import TeamMemberSelector from "../cold-calling/TeamMemberSelector";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getLead, getLeadTaskComments, getLeadTasks, getTeam } from "@/lib/api";
import { useTeam } from "@/context/TeamContext";
import LoadingScreen from "../LoadingScreen";
import { toast } from "react-toastify";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckSquare,
  MessageSquarePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface Props {
  leadId: string;
}

export default function TaskSection({ leadId }: Props) {
  const { user } = useAuth();
  const { teamId } = useTeam();
  const router = useRouter();

  const { installerGroupId } = useInstallerGroup();
  const [lead, setLead] = useState<Lead | null>(null);
  const [team, setTeam] = useState<Team>();
  const [tasks, setTasks] = useState<LeadTask[]>([]);

  const [taskModal, setTaskModal] = useState(false);
  const [commentModal, setCommentModal] = useState(false);

  const [taskComments, setTaskComments] = useState<
    Record<string, { id: string; description: string; created_at: string }[]>
  >({});
  const [newComment, setNewComment] = useState("");

  const [selectedTime, setSelectedTime] = useState<string>("08:00");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateTaskId, setCustomDateTaskId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [selectedMember, setSelectedMember] = useState<string>("");

  const [sendMail, setSendMail] = useState<boolean>(false);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("no-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const today = formatDate(new Date());
  const [title, setTitle] = useState(`Oppgave ${today}`);

  useEffect(() => {
    if (!teamId || !leadId) return;

    getTeam(teamId).then(setTeam).catch(console.error);
    getLeadTasks(leadId)
      .then((tasks) => {
        setTasks(tasks);
        // Hent kommentarer for hver task
        tasks.forEach((task) => {
          getLeadTaskComments(leadId, task.id)
            .then((comments) => {
              setTaskComments((prev) => ({
                ...prev,
                [task.id]: comments.sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
                ),
              }));
            })
            .catch(console.error);
        });
        getLead(leadId).then(setLead);
      })
      .catch(console.error);
  }, [teamId, leadId]);

  const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // Skip lørdag (6) og søndag (0)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }

    return result;
  };

  const addMonths = (date: Date, months: number): Date => {
    const newDate = new Date(date);
    const day = newDate.getDate();
    newDate.setMonth(newDate.getMonth() + months);
    // If the new month has fewer days, it might have rolled over.
    if (newDate.getDate() !== day) {
      // Set to the last day of the previous month (which is the correct target month)
      newDate.setDate(0);
    }
    return newDate;
  };

  const [selectedDate, setSelectedDate] = useState<string>(
    formatDate(addBusinessDays(new Date(), 3)),
  );

  // Generer datoalternativer
  const dateOptions = [
    {
      value: 1,
      label: "Om 1 virkedag",
      date: formatDate(addBusinessDays(new Date(), 1)),
    },
    {
      value: 2,
      label: "Om 2 virkedager",
      date: formatDate(addBusinessDays(new Date(), 2)),
    },
    {
      value: 3,
      label: "Om 3 virkedager",
      date: formatDate(addBusinessDays(new Date(), 3)),
    },
    {
      value: 7,
      label: "Om 1 uke",
      date: formatDate(addBusinessDays(new Date(), 5)), // 1 uke = 5 virkedager
    },
    {
      value: 14,
      label: "Om 2 uker",
      date: formatDate(addBusinessDays(new Date(), 10)), // 2 uker = 10 virkedager
    },
    {
      value: 30,
      label: "Om 1 måned",
      date: formatDate(addMonths(new Date(), 1)),
    },
    {
      value: 90,
      label: "Om 3 måneder",
      date: formatDate(addMonths(new Date(), 3)),
    },
    {
      value: 180,
      label: "Om 6 måneder",
      date: formatDate(addMonths(new Date(), 6)),
    },
    {
      value: "custom",
      label: "Egendefinert dato",
      date: "",
    },
  ];

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 30]) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`;
        times.push(timeString);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          title,
          selectedDate,
          selectedTime,
          description,
          selectedMember,
        }),
      });

      if (!res.ok) throw new Error("Feil ved oppdatering av leads");
      const newTask: LeadTask = await res.json();

      const [day, month, year] = selectedDate.split(".");
      const localIsoString = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${selectedTime}:00`;

      if (lead && selectedMember && sendMail) {
        sendMentionEmail(
          description,
          lead,
          user,
          selectedMember,
          title,
          localIsoString,
        );
      }

      setTasks((prev) => [...prev, newTask]);

      setDescription("");
      setSelectedDate("");
      setSelectedTime("");
      setTaskModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    }
  };

  const handleAddComment = async (taskId: string) => {
    if (!newComment) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadTaskId: taskId,
          description: newComment,
        }),
      });

      if (!res.ok) throw new Error("Feil ved oppretting av kommentar");
      const createdComment = await res.json();

      setTaskComments((prev) => ({
        ...prev,
        [taskId]: [createdComment, ...(prev[taskId] || [])],
      }));
      setNewComment("");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt ved oppretting av kommentar");
    }
    window.location.reload();
    router.push(`?tab=Oppgaver`);
  };

  const handleUpdateDueDate = async (
    task: LeadTask,
    options: { date?: string; time?: string },
  ) => {
    if (!task.due_date) return;

    const current = new Date(task.due_date);

    // Oppdater dato (dd.mm.yyyy)
    if (options.date) {
      const [day, month, year] = options.date.split(".");
      current.setFullYear(Number(year));
      current.setDate(Number(day));
      current.setMonth(Number(month) - 1);
    }

    // Oppdater tid (HH:mm)
    if (options.time) {
      const [hour, minute] = options.time.split(":");
      current.setHours(Number(hour));
      current.setMinutes(Number(minute));
    }

    const id = task.id;

    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          due_date: current.toISOString(),
          id,
        }),
      });

      if (!res.ok) throw new Error();

      // Oppdater lokalt state
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, due_date: current.toISOString() } : t,
        ),
      );
    } catch {
      toast.error("Kunne ikke oppdatere dato");
    }
  };

  const handleUpdateAssignee = async (taskId: string, userId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          assigned_to: userId,
        }),
      });
      if (!res.ok) throw new Error("Could not update assignee");

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, assigned_to: userId } : t)),
      );
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke oppdatere tildeling");
    }
  };

  const sendMentionEmail = async (
    description: string,
    lead: Lead,
    currentUser: User,
    selectedMemberId: string,
    taskTitle: string,
    taskDueDate: string,
  ) => {
    if (!selectedMemberId || !team) return;

    // Sjekk at brukeren finnes i teamet
    const allMembers = team.members || [];
    const assignedMember = allMembers.find(
      (member) => member.user_id === selectedMemberId,
    );

    if (!assignedMember) {
      return;
    }

    // Hent e-postadressen fra users tabellen
    const { data: assignedUserData, error: userError } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", selectedMemberId)
      .single();

    if (userError || !assignedUserData?.email) {
      return;
    }

    // Hent navnet til personen som oppretter oppgaven
    const { data: authorData } = await supabase
      .from("users")
      .select("name")
      .eq("id", currentUser.id)
      .single();
    const authorName = authorData?.name ?? "En bruker";

    const normalizedDate = taskDueDate.replace("Z", "");
    const startDate = new Date(normalizedDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    if (isNaN(startDate.getTime())) return;

    const formatNorwegianDate = (date: Date) => {
      return date.toLocaleString("no-NO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const formatForOutlook = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    let calendarBody = description || "";
    calendarBody += `\n\n--- Lead Informasjon ---\n`;
    calendarBody += `Navn: ${lead.person_info}\n`;
    calendarBody += `Adresse: ${lead.address || "Ikke oppgitt"}\n`;
    calendarBody += `E-post: ${lead.email || "Ikke oppgitt"}\n`;
    calendarBody += `Telefon: ${lead.phone || lead.mobile || "Ikke oppgitt"}\n`;
    calendarBody += `\nLink til lead: ${window.location.origin}${CLIENT_ROUTES.LEADS}/${lead.id}`;

    const outlookParams = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: taskTitle || "Oppgave",
      body: calendarBody,
      startdt: formatForOutlook(startDate),
      enddt: formatForOutlook(endDate),
    });

    const outlookLink = `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams.toString()}`;

    const isValidPhone = (v: unknown) => v && v !== "0" && v !== 0;

    const emailSubject = `Du har fått tildelt en oppgave på lead: ${lead.person_info}`;
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
      <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
        <h1>Soleklart Dashboard</h1>
      </div>
      <div style="padding: 20px;">
        <h2 style="color: #4f46e5;">Du har fått tildelt en oppgave</h2>
        <p><strong>${authorName}</strong> har tildelt deg en oppgave på leadet <strong>${lead.person_info}</strong>.</p>
        
        <div style="background-color: #f0f4ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 3px solid #0078D4;">
          <h3 style="color: #0078D4; margin-top: 0;">📅 ${taskTitle}</h3>
          <p style="margin: 5px 0;"><strong>Dato:</strong> ${formatNorwegianDate(startDate)}</p>
        </div>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 3px solid #4f46e5;">
          <p style="margin: 0; white-space: pre-wrap;">${description.replace(/\n/g, "<br>")}</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${outlookLink}" style="background-color: #0078D4; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
            📅 Legg til i Outlook-kalender
          </a>
        </div>

        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        
        <div>
          <h3 style="color: #4f46e5;">Lead Detaljer:</h3>
          <p><strong>Navn:</strong> ${lead.person_info}</p>
          <p><strong>Adresse:</strong> ${lead.address || "Ikke oppgitt"}</p>
          <p><strong>E-post:</strong> ${lead.email || "Ikke oppgitt"}</p>
          <p><strong>Telefon:</strong> ${
            isValidPhone(lead.phone)
              ? lead.phone
              : isValidPhone(lead.mobile)
                ? lead.mobile
                : "Ikke oppgitt"
          }</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${window.location.origin}${CLIENT_ROUTES.LEADS}/${lead.id}?tab=Oppgaver" style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Se lead i dashboard
          </a>
        </div>
      </div>
      <div style="background-color: #f2f2f2; text-align: center; padding: 15px; font-size: 12px; color: #666;">
        <p>Dette er en automatisk varsling fra Soleklart Dashboard.</p>
      </div>
    </div>
  `;

    try {
      await fetch("/api/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: assignedUserData.email,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
      toast.success(
        `E-post sendt til ${assignedUserData.name || assignedUserData.email}`,
      );
    } catch (error) {
      console.error("Feil ved sending av e-post:", error);
      toast.error("Kunne ikke sende e-postvarsel");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!taskId) return;

    const confirmDelete = window.confirm("Er du sikker på at du vil slette?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Kunne ikke slette oppgave");

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Oppgave slettet!");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt ved sletting");
    }
  };

  if (!user) return <LoadingScreen />;

  return (
    <div className="flex flex-col gap-4">
      <div className="sk-card flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="sk-section-title">Oppgaver</h2>
          {tasks.length > 0 && (
            <span className="sk-badge sk-badge-neutral">{tasks.length}</span>
          )}
        </div>
        <button
          onClick={() => setTaskModal(!taskModal)}
          className={`sk-btn ${taskModal ? "sk-btn-secondary" : "sk-btn-primary"}`}
        >
          {taskModal ? <X size={15} /> : <Plus size={15} />}
          Opprett oppgave
        </button>
      </div>
      {taskModal && (
        <div className="sk-card animate-pop-in overflow-hidden ring-2 ring-blue-100">
          <div className="flex items-center gap-2 border-b border-line bg-brand-soft/60 px-5 py-3">
            <CheckSquare size={16} className="shrink-0 text-brand" />
            <input
              className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 font-display text-base font-semibold text-ink hover:border-line hover:bg-surface focus:bg-surface"
              value={title || ""}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
              <div className="flex w-full flex-col">
                <label className="sk-label">Aktivitetsdato</label>
                <select
                  className="sk-input"
                  value={useCustomDate ? "custom" : selectedDate}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setUseCustomDate(true);
                      setSelectedDate("");
                    } else {
                      setUseCustomDate(false);
                      setSelectedDate(e.target.value);
                    }
                  }}
                >
                  <option value="">Velg dato...</option>
                  {dateOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.date || String(option.value)}
                    >
                      {option.label} {option.date && `[${option.date}]`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-full flex-col">
                <label className="sk-label">Tid</label>
                <select
                  value={selectedTime}
                  className="sk-input tabular-nums"
                  onChange={(e) => setSelectedTime(e.target.value)}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-full flex-col [&_select]:w-full">
                <label className="sk-label">Aktivitet tilordnet</label>
                <TeamMemberSelector
                  team={team}
                  selectedMember={selectedMember}
                  onSelectMember={setSelectedMember}
                  defaultUser={user.id}
                  includeInstallers
                  installerGroupId={installerGroupId}
                />
              </div>
              <button
                type="button"
                onClick={() => setSendMail(!sendMail)}
                title={sendMail ? "E-postvarsel på" : "E-postvarsel av"}
                aria-pressed={sendMail}
                className={`inline-flex size-9 items-center justify-center rounded-lg border ${
                  sendMail
                    ? "border-blue-200 bg-brand-soft text-brand"
                    : "border-line bg-surface text-muted hover:bg-gray-50 hover:text-ink"
                }`}
              >
                {sendMail ? <Bell size={16} /> : <BellOff size={16} />}
              </button>
            </div>
            {useCustomDate && (
              <input
                type="date"
                className="sk-input mt-2 md:max-w-xs"
                onBlur={(e) => {
                  if (e.target.value) {
                    const [year, month, day] = e.target.value.split("-");
                    setSelectedDate(`${day}.${month}.${year}`);
                  } else {
                    setSelectedDate("");
                  }
                }}
              />
            )}
            <textarea
              placeholder="Legg inn oppgaven din.."
              className="sk-textarea mt-4 min-h-40"
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleCreateTask}
                className="sk-btn sk-btn-accent"
              >
                <Plus size={15} />
                Opprett
              </button>
            </div>
          </div>
        </div>
      )}
      {tasks.length === 0 && !taskModal && (
        <div className="sk-empty">
          <CheckSquare size={22} className="text-gray-400" />
          Ingen oppgave
        </div>
      )}
      {tasks
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .map((task, i) => (
          <div className="sk-card animate-fade-in overflow-hidden" key={i}>
            <div className="flex flex-row items-center justify-between gap-2 border-b border-line px-5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                  <CheckSquare size={14} />
                </span>
                <h3 className="truncate text-sm font-semibold text-ink">
                  {task.title}
                </h3>
              </div>
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="sk-btn sk-btn-danger-ghost sk-btn-sm"
              >
                <Trash2 size={14} />
                Slett
              </button>
            </div>
            <div className="p-5">
              {task.description && (
                <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-body">
                  {task.description}
                </p>
              )}
              <div className="grid grid-cols-1 items-end gap-3 rounded-xl bg-gray-50 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)]">
                <div className="flex w-full flex-col">
                  <label className="sk-label flex items-center gap-1">
                    <CalendarClock size={12} className="text-muted" />
                    Aktivitetsdato
                  </label>
                  <select
                    className="sk-input"
                    value={
                      customDateTaskId === task.id
                        ? "custom"
                        : task.due_date
                          ? new Date(task.due_date).toLocaleDateString("no-NO")
                          : ""
                    }
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setCustomDateTaskId(task.id);
                      } else {
                        setCustomDateTaskId(null);
                        handleUpdateDueDate(task, {
                          date: e.target.value,
                        });
                      }
                    }}
                  >
                    {task.due_date && (
                      <option
                        value={new Date(task.due_date).toLocaleDateString(
                          "no-NO",
                        )}
                      >
                        {new Date(task.due_date).toLocaleDateString("no-NO")}
                      </option>
                    )}

                    {dateOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.date || String(option.value)}
                      >
                        {option.label} {option.date && `[${option.date}]`}
                      </option>
                    ))}
                  </select>
                  {customDateTaskId === task.id && (
                    <input
                      type="date"
                      className="sk-input mt-2"
                      defaultValue={
                        task.due_date
                          ? new Date(task.due_date).toISOString().split("T")[0]
                          : ""
                      }
                      onBlur={(e) => {
                        if (e.target.value) {
                          const [year, month, day] = e.target.value.split("-");
                          const formatted = `${day}.${month}.${year}`;

                          handleUpdateDueDate(task, { date: formatted });
                        }
                        setCustomDateTaskId(null);
                      }}
                    />
                  )}
                </div>
                <div className="flex w-full flex-col">
                  <label className="sk-label">Tid</label>
                  <select
                    className="sk-input tabular-nums"
                    value={
                      task.due_date
                        ? (() => {
                            const d = new Date(task.due_date);
                            d.setHours(d.getHours());
                            return d.toLocaleTimeString("no-NO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                          })()
                        : ""
                    }
                    onChange={(e) =>
                      handleUpdateDueDate(task, { time: e.target.value })
                    }
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex w-full flex-col [&_select]:w-full">
                  <label className="sk-label">Aktivitet tilordnet</label>
                  <TeamMemberSelector
                    team={team}
                    selectedMember={task.assigned_to}
                    onSelectMember={(userId) =>
                      handleUpdateAssignee(task.id, userId)
                    }
                    defaultUser={task.assigned_to}
                    includeInstallers
                    installerGroupId={installerGroupId}
                  />
                </div>
              </div>

              <button
                onClick={() => setCommentModal(!commentModal)}
                className="sk-btn sk-btn-secondary sk-btn-sm mt-4"
              >
                <MessageSquarePlus size={14} />
                Legg til aktivitet
              </button>
              {/* Legg til kommentar */}
              {commentModal && (
                <div className="mt-3 animate-fade-in">
                  <textarea
                    className="sk-textarea h-24"
                    value={newComment || ""}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      className="sk-btn sk-btn-primary sk-btn-sm"
                      onClick={() => handleAddComment(task.id)}
                    >
                      Kommenter
                    </button>
                  </div>
                </div>
              )}
              {(taskComments[task.id] || []).length > 0 && (
                <ul className="mt-4 flex flex-col gap-2 border-l-2 border-line pl-4">
                  {(taskComments[task.id] || []).map((comment, i) => (
                    <li key={comment.id + i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-gray-300 ring-2 ring-surface" />
                      <p className="text-xs font-medium tabular-nums text-muted">
                        {formatDate(new Date(comment.created_at))}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-body">
                        {comment.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
