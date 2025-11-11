import LeadsTable from "@/app/components/LeadsTable";
import { CLIENT_ROUTES } from "@/constants/routes";
import Link from "next/link";

export default function LeadsPage() {
  return (
    <div>
      <Link href={CLIENT_ROUTES.CREATE_LEAD}>Opprett ny avtale</Link>
      <LeadsTable />
    </div>
  );
}
