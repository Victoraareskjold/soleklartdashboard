"use client";

import { CLIENT_ROUTES } from "@/constants/routes";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function AuthPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        router.push(CLIENT_ROUTES.OVERVIEW);
      }

      if (!isLogin) {
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
        toast.success("Please check your email to verify your account");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6">
          {isLogin ? "Log in" : "Sign up"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block mb-1 font-semibold">Name</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block mb-1 font-semibold">Email</label>
            <input
              type="email"
              className="w-full border p-2 rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Password</label>
            <input
              type="password"
              className="w-full border p-2 rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="px-5 py-3 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md font-semibold hover:opacity-80 transition duration-200"
            disabled={loading}
          >
            {loading ? "Loading..." : isLogin ? "Log in" : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          {isLogin ? "Not registered yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-500 underline"
          >
            {isLogin ? "Sign up here" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
