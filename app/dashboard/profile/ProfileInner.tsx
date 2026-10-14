"use client";
import ConnectOutlook from "@/app/components/user/connectOutlook";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Mail, Phone, LogOut, CheckCircle, Loader2 } from "lucide-react";
import { CLIENT_ROUTES } from "@/constants/routes";

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
    window.location.href = CLIENT_ROUTES.AUTH;
  };

  if (loading)
    return (
      <div className="sk-page">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          Laster profil...
        </div>
      </div>
    );

  const displayName = profile?.name || profile?.email || "";
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .filter((_, i, arr) => i === 0 || i === arr.length - 1)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="sk-page max-w-5xl">
      {/* Header Seksjon */}
      <div className="sk-page-header">
        <div>
          <h1 className="sk-page-title">Min Profil</h1>
          <p className="sk-page-subtitle">
            Administrer din personlige informasjon og integrasjoner
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="sk-btn sk-btn-secondary text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut size={16} />
          Logg ut
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Brukerinfo Kort */}
        <div className="space-y-4 md:col-span-1">
          <div className="sk-card overflow-hidden">
            <div className="relative h-20 bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500">
              <div className="absolute -top-6 right-0 size-24 rounded-full bg-orange-400/40 blur-2xl" />
            </div>
            <div className="-mt-8 px-6 pb-6">
              <span className="inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 font-display text-lg font-semibold text-white ring-4 ring-white shadow-card">
                {initials}
              </span>
              <p className="mt-3 font-display text-base font-semibold text-ink">
                {profile?.name || "Ikke satt"}
              </p>
              <p className="text-xs text-muted">{profile?.email}</p>

              <div className="sk-divider my-5" />

              <dl className="space-y-4">
                <div>
                  <dt className="sk-eyebrow">Navn</dt>
                  <dd className="mt-1 text-sm font-medium text-ink">
                    {profile?.name || "Ikke satt"}
                  </dd>
                </div>
                <div>
                  <dt className="sk-eyebrow">E-post</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm text-ink">
                    <Mail size={14} className="shrink-0 text-muted" />
                    <span className="truncate">{profile?.email}</span>
                  </dd>
                </div>
                <div>
                  <dt className="sk-eyebrow">Telefon</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm text-ink">
                    <Phone size={14} className="shrink-0 text-muted" />
                    <span>{profile?.phone || "Ikke registrert"}</span>
                  </dd>
                </div>
                <div>
                  <dt className="sk-eyebrow">Profil Id</dt>
                  <dd className="mt-1 break-all rounded-md bg-gray-50 px-2 py-1 font-mono text-[11px] text-body">
                    {user?.id}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Integrasjoner Seksjon */}
        <div className="space-y-6 md:col-span-2">
          <div className="sk-card">
            <div className="sk-card-header">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Mail size={17} />
                </span>
                <h2 className="sk-section-title">E-post integrasjon</h2>
              </div>
            </div>

            <div className="sk-card-body space-y-4">
              {connectedEmails.length > 0 ? (
                <div className="space-y-2">
                  <p className="sk-eyebrow">Tilkoblede kontoer:</p>
                  {connectedEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CheckCircle
                          size={16}
                          className="shrink-0 text-emerald-600"
                        />
                        <span className="truncate text-sm font-medium text-ink">
                          {email}
                        </span>
                      </div>
                      <span className="sk-badge sk-badge-success">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Aktiv
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sk-empty py-8">
                  <Mail size={20} className="text-gray-400" />
                  Ingen e-postkontoer er tilkoblet ennå.
                </div>
              )}

              <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-xs text-muted">
                  Ved å koble til Outlook kan du sende e-post direkte fra
                  systemet.
                </p>
                <ConnectOutlook />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
