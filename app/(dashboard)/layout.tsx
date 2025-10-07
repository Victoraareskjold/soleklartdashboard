import { TeamProvider } from "@/context/TeamContext";
import "../globals.css";
import Navbar from "../components/Navbar";
import { InstallerGroupProvider } from "@/context/InstallerGroupContext";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TeamProvider>
      <InstallerGroupProvider>
        <Navbar />
        <div className="p-2">{children}</div>
      </InstallerGroupProvider>
    </TeamProvider>
  );
}
