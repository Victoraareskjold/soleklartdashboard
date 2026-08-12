"use client";
import ConnectOutlook from "@/app/components/user/connectOutlook";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Mail, Phone, LogOut, CheckCircle } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

export default function ProfilePageInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const { installerGroupId } = useInstallerGroup();
  const [user, setUser] = useState<User>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [connectedEmails, setConnectedEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Error getting user:", authError);
        setLoading(false);
        return;
      }

      setUser(user);

      // Hent ekstra felter fra public.users
      const { data: profileData } = await supabase
        .from("users")
        .select("id, email, name, phone")
        .eq("id", user.id)
        .single();

      if (profileData) setProfile(profileData);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Hent tilkoblede e-postkontoer
  useEffect(() => {
    const getConnectedEmails = async () => {
      if (!user || !installerGroupId) return;

      const { data } = await supabase
        .from("email_accounts")
        .select("email")
        .eq("user_id", user.id)
        .eq("installer_group_id", installerGroupId);

      if (data) {
        setConnectedEmails(
          data.map((item) => item.email).filter(Boolean) as string[],
        );
      }
    };

    getConnectedEmails();
  }, [user, installerGroupId]);

  // Håndter Outlook OAuth exchange
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
          toast.success("E-post tilkoblet!");
          // Oppdater listen uten reload
          setConnectedEmails((prev) => [...new Set([...prev, data.email])]);
        } else {
          toast.error("Kunne ikke koble til e-post");
        }
      } catch (err) {
        console.error(err);
      }
    };

    exchangeCode();
  }, [code, user, installerGroupId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ut");
    window.location.href = "/";
  };

  if (loading)
    return <div className="p-8 text-slate-500">Laster profil...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header Seksjon */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Min Profil</h1>
          <p className="text-slate-500 text-sm">
            Administrer din personlige informasjon og integrasjoner
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <LogOut size={16} />
          Logg ut
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Brukerinfo Kort */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">
                  Navn
                </label>
                <p className="text-slate-700 font-medium">
                  {profile?.name || "Ikke satt"}
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">
                  E-post
                </label>
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail size={14} />
                  <p className="text-sm">{profile?.email}</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">
                  Telefon
                </label>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone size={14} />
                  <p className="text-sm">
                    {profile?.phone || "Ikke registrert"}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase font-semibold">
                  Profil Id
                </label>
                <p className="text-sm">{user?.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Integrasjoner Seksjon */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              E-post integrasjon
            </h2>

            <div className="space-y-4">
              {connectedEmails.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">Tilkoblede kontoer:</p>
                  {connectedEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg"
                    >
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">{email}</span>
                      </div>
                      <span className="text-xs text-green-600 font-bold uppercase tracking-wider text-[10px]">
                        Aktiv
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed">
                  Ingen e-postkontoer er tilkoblet ennå.
                </p>
              )}

              <div className="pt-2">
                <ConnectOutlook />
                <p className="mt-2 text-[11px] text-slate-400">
                  Ved å koble til Outlook kan du sende e-post direkte fra
                  systemet.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
