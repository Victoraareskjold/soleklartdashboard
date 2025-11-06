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

  return (
    <div>
      <p>{user?.id}</p>
      <ConnectOutlook />
    </div>
  );
}
