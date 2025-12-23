"use client";
import ConnectOutlook from "@/app/components/user/connectOutlook";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function ProfilePageInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const { installerGroupId } = useInstallerGroup();
  const [user, setUser] = useState<User>();
  const [connectedEmails, setConnectedEmails] = useState<string[]>([]);

  useEffect(() => {
    const getConnectedEmails = async () => {
      if (!user || !installerGroupId) return;

      const { data, error } = await supabase
        .from("email_accounts")
        .select("email")
        .eq("user_id", user.id)
        .eq("installer_group_id", installerGroupId);

      if (error) {
        console.error("Error fetching connected emails:", error);
        return;
      }

      if (data) {
        const emails = data
          .map((item: { email: string | null }) => item.email)
          .filter((email): email is string => email !== null);
        setConnectedEmails(emails);
      }
    };

    getConnectedEmails();
  }, [user, installerGroupId]);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error getting user:", error);
        return;
      }
      setUser(data.user ?? undefined);
    };

    getUser();
  }, []);

  useEffect(() => {
    const exchangeCode = async () => {
      if (!code || !user || !installerGroupId) return;

      try {
        const response = await fetch("/api/email/save-auth-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, userId: user.id, installerGroupId }),
        });
        const data = await response.json();

        if (data.success) {
          toast.success("Success");
        } else {
          toast.error("Error");
        }
      } catch (err) {
        console.error(err);
      }
    };

    exchangeCode();
  }, [code, user, installerGroupId]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error);
      toast.error("Kunne ikke logge ut");
      return;
    }

    toast.success("Logget ut");
    window.location.href = "/";
  };

  return (
    <div>
      <p>{user?.id}</p>
      {connectedEmails.length > 0 && (
        <div>
          <p>Tilkoblede e-poster:</p>
          <ul>
            {connectedEmails.map((email) => (
              <li key={email}>{email}</li>
            ))}
          </ul>
        </div>
      )}
      <ConnectOutlook />
      <button onClick={handleLogout}>Logg ut</button>
    </div>
  );
}
