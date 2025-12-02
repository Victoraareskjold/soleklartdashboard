import { TeamProvider } from "@/context/TeamContext";
import "../globals.css";
import Navbar from "../components/Navbar";
import { InstallerGroupProvider } from "@/context/InstallerGroupContext";
import { RoleProvider } from "@/context/RoleProvider";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
