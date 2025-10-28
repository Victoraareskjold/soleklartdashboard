"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

export interface Email {
  id: string;
  subject: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  receivedDateTime: string;
  bodyPreview: string;
}

export default function EmailTest() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const { installerGroupId } = useInstallerGroup();

  useEffect(() => {
    if (!installerGroupId) return;
    const fetchEmails = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("Ingen bruker funnet");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/email/get-emails?userId=${user.id}&installerGroupId=${installerGroupId}`
        );

        const data = await res.json();

        if (data.success) {
          setEmails(data.mails);
        } else {
          console.error(
            "Feil ved henting av eposter:",
            data.error || data.details
          );
        }
      } catch (err) {
        console.error("Fetch-feil:", err);
      }

      setLoading(false);
    };

    fetchEmails();
  }, [installerGroupId]);

  if (loading) return <p>Laster eposter...</p>;
  if (!emails.length) return <p>Ingen eposter funnet</p>;

  return (
    <div className="p-4">
      <h2 className="font-semibold text-lg mb-2">
        Eposter hentet fra Outlook:
      </h2>
      <ul className="space-y-2">
        {emails.map((mail) => (
          <li
            key={mail.id}
            className="p-3 border rounded-md bg-white shadow-sm hover:bg-gray-50"
          >
            <div className="font-medium">{mail.subject}</div>
            <div className="text-sm text-gray-600">
              Fra: {mail.from?.emailAddress?.address}
            </div>
            <div className="text-xs text-gray-500">
              Mottatt: {new Date(mail.receivedDateTime).toLocaleString()}
            </div>
            <p className="text-sm mt-1">{mail.bodyPreview}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
