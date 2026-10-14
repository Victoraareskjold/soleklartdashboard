import { CLIENT_ROUTES } from "@/constants/routes";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Sun,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { Logo } from "@/app/components/site/Logo";

export default function AuthPageContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const installerGroupId = searchParams.get("inviteLink");
  const redirectTo = searchParams.get("redirect");

  useEffect(() => {
    if (installerGroupId) {
      setIsLogin(false);
    }
  }, [installerGroupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo || CLIENT_ROUTES.PRICETABLE);
      }

      if (!isLogin) {
        // Valider at passordene matcher
        if (password !== confirmPassword) {
          toast.error("Passordene matcher ikke");
          setLoading(false);
          return;
        }

        // Valider passordlengde
        if (password.length < 6) {
          toast.error("Passordet må være minst 6 tegn");
          setLoading(false);
          return;
        }

        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}${CLIENT_ROUTES.DASHBOARD}`,
            },
          });
        if (signUpError) throw signUpError;

        if (signUpData.user) {
          const userId = signUpData.user.id;

          const { error: userError } = await supabase.from("users").insert({
            id: userId,
            email,
            name,
          });
          if (userError) throw userError;

          const { error: teamMemberError } = await supabase
            .from("team_members")
            .insert({
              team_id: "13eaf450-c3d1-4b1b-912e-084c173f3398",
              user_id: userId,
              role: "installer",
              installer_group_id: installerGroupId,
            });
          if (teamMemberError) throw teamMemberError;
        }

        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        toast.success("Vennligst sjekk e-posten din for å verifisere kontoen");
      }
    } catch (err) {
      console.error(err);
      toast.error("Autentisering feilet");
    } finally {
      setLoading(false);
    }
  };

  // Sjekk om passordene matcher (for visuell feedback)
  const passwordsMatch =
    !isLogin && confirmPassword !== "" && password === confirmPassword;
  const passwordsDontMatch =
    !isLogin && confirmPassword !== "" && password !== confirmPassword;

  return (
    <div className="sk-dash grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Merkevarepanel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b1b33] via-[#0e2c63] to-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Sol-glød */}
        <div className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(250,163,26,0.55)_0%,rgba(250,163,26,0.18)_35%,transparent_68%)]" />
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-[radial-gradient(circle,rgba(253,208,138,0.7)_0%,transparent_70%)] blur-xl" />
        {/* Diskret rutenett */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

        <div className="relative">
          <Logo variant="white" height={30} priority />
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            <Sun size={14} className="text-orange-300" />
            Soleklart dashbord
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            Fra lead til ferdig solcelleanlegg — samlet på ett sted.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Følg opp kunder, lag tilbud og samarbeid med teamet ditt.
          </p>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Soleklart
        </p>
      </aside>

      {/* Skjema */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-pop-in">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo variant="dark" height={28} priority />
          </div>

          <div className="sk-card p-8 shadow-pop">
            <div className="mb-7">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {isLogin ? "Logg inn" : "Opprett konto"}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {isLogin
                  ? "Velkommen tilbake! Logg inn for å fortsette."
                  : "Fyll inn opplysningene under for å komme i gang."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="sk-label">Navn</label>
                  <div className="relative">
                    <UserIcon
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      className="sk-input h-11 pl-9"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="sk-label">E-post</label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="email"
                    className="sk-input h-11 pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="sk-label">Passord</label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="password"
                    className="sk-input h-11 pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {!isLogin && password.length > 0 && password.length < 6 && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    Passordet må være minst 6 tegn
                  </p>
                )}
              </div>

              {!isLogin && (
                <div>
                  <label className="sk-label">Bekreft passord</label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="password"
                      className={`sk-input h-11 pl-9 ${
                        passwordsDontMatch
                          ? "border-red-400 hover:border-red-400 focus:border-red-500"
                          : passwordsMatch
                            ? "border-emerald-400 hover:border-emerald-400 focus:border-emerald-500"
                            : ""
                      }`}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  {passwordsDontMatch && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                      <XCircle size={14} />
                      Passordene matcher ikke
                    </p>
                  )}
                  {passwordsMatch && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 size={14} />
                      Passordene matcher
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="sk-btn sk-btn-primary sk-btn-lg mt-2 w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Laster...
                  </>
                ) : (
                  <>
                    {isLogin ? "Logg inn" : "Opprett konto"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="sk-divider my-6" />

            <p className="text-center text-sm text-muted">
              {isLogin ? "Ikke registrert ennå?" : "Har du allerede en konto?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="font-semibold text-brand hover:text-brand-hover hover:underline"
              >
                {isLogin ? "Opprett konto" : "Logg inn"}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
