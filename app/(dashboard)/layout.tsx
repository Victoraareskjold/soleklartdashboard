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
    <RoleProvider>
      <TeamProvider>
        <InstallerGroupProvider>
          <Navbar />
          <div>{children}</div>
        </InstallerGroupProvider>
      </TeamProvider>
    </RoleProvider>
  );
}
