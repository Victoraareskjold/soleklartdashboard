"use client";

import { TeamProvider } from "@/context/TeamContext";
import "../globals.css";
import Navbar from "../components/Navbar";
import { InstallerGroupProvider } from "@/context/InstallerGroupContext";
import { RoleProvider } from "@/context/RoleProvider";
import { useAuth } from "@/context/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingScreen from "../components/LoadingScreen";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  return (
    <TeamProvider>
      <InstallerGroupProvider>
        <RoleProvider>
          <div className="sk-dash flex min-h-screen flex-row">
            <Navbar />
            <main className="ml-64 flex min-h-screen w-[calc(100%-16rem)] flex-col">
              {children}
            </main>
          </div>
        </RoleProvider>
      </InstallerGroupProvider>
    </TeamProvider>
  );
}
