"use client";
import { LeadTask, Team } from "@/lib/types";
import TeamMemberSelector from "../cold-calling/TeamMemberSelector";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getLeadTaskComments, getLeadTasks, getTeam } from "@/lib/api";
import { useTeam } from "@/context/TeamContext";
import LoadingScreen from "../LoadingScreen";
import { toast } from "react-toastify";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

interface Props {
  leadId: string;
}

export default function TaskSection({ leadId }: Props) {
  const { user } = useAuth();
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const [team, setTeam] = useState<Team>();
  const [tasks, setTasks] = useState<LeadTask[]>([]);

  const [taskModal, setTaskModal] = useState(false);
  const [commentModal, setCommentModal] = useState(false);

  const [taskComments, setTaskComments] = useState<
    Record<string, { id: string; description: string; created_at: string }[]>
  >({});
  const [newComment, setNewComment] = useState("");

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("08:00");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateTaskId, setCustomDateTaskId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [selectedMember, setSelectedMember] = useState<string>("");

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
                    new Date(a.created_at).getTime()
                ),
              }));
            })
            .catch(console.error);
        });
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

      setDescription("");
      setSelectedDate("");
      setSelectedTime("");
      setTaskModal(false);
      window.location.reload();
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
  };

  const handleUpdateDueDate = async (
    task: LeadTask,
    options: { date?: string; time?: string }
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
          t.id === task.id ? { ...t, due_date: current.toISOString() } : t
        )
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
        prev.map((t) => (t.id === taskId ? { ...t, assigned_to: userId } : t))
      );
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke oppdatere tildeling");
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
            <div className="mt-2 flex flex-row gap-2">
              <div className="flex flex-col w-full">
                <label>Aktivitetsdato</label>
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
                    onChange={(e) => {
                      const [year, month, day] = e.target.value.split("-");
                      setSelectedDate(`${day}.${month}.${year}`);
                    }}
                  />
                )}
              </div>
              <div className="flex flex-col w-full">
                <label className="text-white">.</label>
                <select
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
                <label>Aktivitet tilordnet</label>
                <TeamMemberSelector
                  team={team}
                  selectedMember={selectedMember}
                  onSelectMember={setSelectedMember}
                  defaultUser={user.id}
                  includeInstallers
                  installerGroupId={installerGroupId}
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
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .map((task, i) => (
          <div className="mt-4 bg-white" key={i}>
            <div className="bg-[#7787FF] p-2 text-white">
              <input value={task.title} readOnly />
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
                          "no-NO"
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
                      onChange={(e) => {
                        const [year, month, day] = e.target.value.split("-");
                        const formatted = `${day}.${month}.${year}`;

                        handleUpdateDueDate(task, { date: formatted });
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
