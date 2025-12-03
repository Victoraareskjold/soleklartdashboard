import { CLIENT_ROUTES } from "@/constants/routes";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

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
        router.push(CLIENT_ROUTES.PRICETABLE);
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
              emailRedirectTo: `${window.location.origin}/${CLIENT_ROUTES.DASHBOARD}`,
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-blue-600">
            {isLogin ? "Logg inn" : "Opprett konto"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Navn
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block mb-2 font-semibold text-gray-700">
              E-post
            </label>
            <input
              type="email"
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold text-gray-700">
              Passord
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {!isLogin && password.length > 0 && password.length < 6 && (
              <p className="text-red-500 text-sm mt-1">
                Passordet må være minst 6 tegn
              </p>
            )}
          </div>

          {!isLogin && (
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Bekreft passord
              </label>
              <input
                type="password"
                className={`w-full border p-3 rounded-lg focus:ring-2 focus:border-transparent outline-none transition ${
                  passwordsDontMatch
                    ? "border-red-500 focus:ring-red-500"
                    : passwordsMatch
                    ? "border-green-500 focus:ring-green-500"
                    : "border-gray-300 focus:ring-indigo-500"
                }`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {passwordsDontMatch && (
                <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Passordene matcher ikke
                </p>
              )}
              {passwordsMatch && (
                <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Passordene matcher
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="px-5 py-3 w-full rounded-lg bg-blue-200 text-blue-600 shadow-md font-semibold hover:from-indigo-600 hover:to-violet-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Laster..." : isLogin ? "Logg inn" : "Opprett konto"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {isLogin ? "Ikke registrert ennå?" : "Har du allerede en konto?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 font-semibold hover:text-blue-700 underline"
          >
            {isLogin ? "Opprett konto" : "Logg inn"}
          </button>
        </p>
      </div>
    </div>
  );
}
