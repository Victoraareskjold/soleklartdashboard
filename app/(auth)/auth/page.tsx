"use client";
import { CLIENT_ROUTES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(CLIENT_ROUTES.DASHBOARD);
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
            name: "",
          });
          if (userError) throw userError;
        }

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

        {message && <p className="mb-4 text-red-500">{message}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
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
