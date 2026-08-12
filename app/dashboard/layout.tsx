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
          <div className="flex flex-row">
            <Navbar />
            <div className="bg-gray-50 min-h-screen w-full flex flex-col ml-64">
              <div className="p-2">{children}</div>
            </div>
          </div>
        </RoleProvider>
      </InstallerGroupProvider>
    </TeamProvider>
  );
}
