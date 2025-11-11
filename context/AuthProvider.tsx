"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

const clearUserLocalStorage = () => {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.startsWith("teamId_") || key.startsWith("domainId_")) {
      localStorage.removeItem(key);
    }
  });
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const newUser = session?.user ?? null;

        // Hvis bruker logger ut eller bytter, rydd localStorage
        if (
          event === "SIGNED_OUT" ||
          (user && newUser && user.id !== newUser.id)
        ) {
          clearUserLocalStorage();
        }

        setUser(newUser);
      }
    );

    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
