"use client";
import { Team } from "@/lib/types";
import TeamMemberSelector from "../cold-calling/TeamMemberSelector";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getTeam } from "@/lib/api";
import { useTeam } from "@/context/TeamContext";
import LoadingScreen from "../LoadingScreen";

interface Props {
  leadId: string;
}

export default function TaskSection({ leadId }: Props) {
  const { user } = useAuth();
  const { teamId } = useTeam();
  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  // Formater dato til norsk format (dd.mm.yyyy)
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
    if (!teamId) return;

    Promise.all([getTeam(teamId).then(setTeam)]).catch((err) =>
      console.error(err)
    );
  }, [teamId]);

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

  // Funksjon for å legge til måneder
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

  if (!user) return <LoadingScreen />;

  return (
    <div className="">
      <button className="p-2 bg-blue-700 text-white rounded-md">
        Opprett oppgave
      </button>
      <div className="mt-4 bg-white">
        <div className="bg-blue-700 p-2 text-white">
          <input
            value={title || ""}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="p-2">
          <div className="mt-2 flex flex-row gap-2">
            <div className="flex flex-col w-full">
              <label>Aktivitetsdato</label>
              <select className="w-full p-2 border rounded">
                <option value="">Velg dato...</option>
                {dateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} {option.date && `[${option.date}]`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col w-full">
              <label className="text-white">.</label>
              <select className="w-full p-2 border rounded">
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
              />
            </div>
          </div>
          <textarea
            placeholder="Legg inn oppgaven din.."
            className="w-full p-2 border-t mt-4 min-h-64"
          />
          <button className="px-6 py-2 mt-4 bg-[#FF8E4C] rounded-md text-white">
            Opprett
          </button>
        </div>
      </div>
    </div>
  );
}
