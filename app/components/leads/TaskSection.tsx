/* eslint-disable @next/next/no-img-element */
"use client";
import { Lead, LeadTask, Team } from "@/lib/types";
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
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
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
      current.setMonth(Number(month) - 1);
      current.setDate(Number(day));
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
    console.log("DEBUG: taskDueDate mottatt fra API:", taskDueDate);
    console.log("DEBUG: Type of taskDueDate:", typeof taskDueDate);

    // Sjekk at brukeren finnes i teamet
    const allMembers = team.members || [];
    const assignedMember = allMembers.find(
      (member) => member.user_id === selectedMemberId,
    );

    if (!assignedMember) {
      console.log("Kunne ikke finne bruker i teamet");
      return;
    }

    // Hent e-postadressen fra users tabellen
    const { data: assignedUserData, error: userError } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", selectedMemberId)
      .single();

    if (userError || !assignedUserData?.email) {
      console.log("Kunne ikke finne brukerens e-post:", userError);
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
    calendarBody += `\nLink til lead: ${window.location.origin}/leads/${lead.id}`;

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
          <a href="${window.location.origin}/leads/${lead.id}?tab=Oppgaver" style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Se lead i dashboard
          </a>
        </div>
      </div>
      <div style="background-color: #f2f2f2; text-align: center; padding: 15px; font-size: 12px; color: #666;">
        <p>Dette er en automatisk varsling fra Soleklart Dashboard.</p>
      </div>
    </div>
  `;

    console.log(
      "Sender e-post til:",
      assignedUserData.email,
      "Emne:",
      emailSubject,
    );

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
    <div className="">
      <button
        onClick={() => setTaskModal(!taskModal)}
        className="p-2 bg-[#7787FF] text-white rounded-md"
      >
        Opprett oppgave
      </button>
      {taskModal && (
        <div className="mt-4 bg-white">
          <div className="bg-[#7787FF] p-2 text-white">
            <input
              value={title || ""}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="p-2">
            <div className="mt-2 flex flex-row gap-5">
              <div className="flex flex-col w-full">
                <label className="opacity-70 text-sm mb-1">
                  Aktivitetsdato
                </label>
                <select
                  className="w-full p-2 border rounded"
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
                {useCustomDate && (
                  <input
                    type="date"
                    className="w-full p-2 border rounded mt-2"
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
              </div>
              <div className="flex flex-col w-full">
                <label className="text-white text-sm mb-1">.</label>
                <select
                  value={selectedTime}
                  className="w-full p-2 border rounded"
                  onChange={(e) => setSelectedTime(e.target.value)}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col w-full">
                <label className="opacity-70 text-sm mb-1">
                  Aktivitet tilordnet
                </label>
                <TeamMemberSelector
                  team={team}
                  selectedMember={selectedMember}
                  onSelectMember={setSelectedMember}
                  defaultUser={user.id}
                  includeInstallers
                  installerGroupId={installerGroupId}
                />
              </div>
              <div>
                <label className="text-white text-sm mb-1">.</label>
                <img
                  src={`${sendMail ? "/icons/bellOn.png" : "/icons/bellOff.png"}`}
                  className="w-20 cursor-pointer"
                  onClick={() => setSendMail(!sendMail)}
                  alt="bell-icon"
                />
              </div>
            </div>
            <textarea
              placeholder="Legg inn oppgaven din.."
              className="w-full p-2 border-t mt-4 min-h-64"
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              onClick={handleCreateTask}
              className="px-6 py-2 mt-4 bg-[#FF8E4C] rounded-md text-white"
            >
              Opprett
            </button>
          </div>
        </div>
      )}
      {tasks
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .map((task, i) => (
          <div className="mt-4 bg-white" key={i}>
            <div className="bg-[#7787FF] p-2 text-white flex flex-row items-center justify-between">
              <input value={task.title} readOnly />
              <button
                onClick={() => handleDeleteTask(task.id)}
                className="py-2 px-4 bg-red-200 hover:bg-red-500 text-red-500 hover:text-white duration-200 rounded-md font-medium items-center flex flex-row gap-1 text-sm"
              >
                Slett
              </button>
            </div>
            <div className="p-2">
              <div className="w-full p-2">
                <textarea
                  className="w-full"
                  readOnly
                  value={task.description}
                />
              </div>
              <div className="mt-2 flex flex-row gap-2">
                <div className="flex flex-col w-full">
                  <label>Aktivitetsdato</label>
                  <select
                    className="w-full p-2 border rounded"
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
                      className="w-full p-2 border rounded mt-2"
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
                <div className="flex flex-col w-full">
                  <label className="text-white">.</label>
                  <select
                    className="w-full p-2 border rounded"
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

                <div className="flex flex-col w-full">
                  <label>Aktivitet tilordnet</label>
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
                className="bg-[#52FF4C] px-6 py-2 text-white mt-3 rounded-md"
              >
                Legg til aktivitet
              </button>
              {/* Legg til kommentar */}
              {commentModal && (
                <div className="mt-2">
                  <textarea
                    className="w-full p-2 border-t rounded-md mt-4 h-24 border"
                    value={newComment || ""}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded mt-2"
                    onClick={() => handleAddComment(task.id)}
                  >
                    Kommenter
                  </button>
                </div>
              )}
              {(taskComments[task.id] || []).map((comment, i) => (
                <div
                  key={comment.id + i}
                  className="w-full p-2 border-t rounded-md mt-4 h-24 border"
                >
                  <p>{formatDate(new Date(comment.created_at))}</p>
                  <textarea
                    className="w-full"
                    readOnly
                    value={comment.description}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
