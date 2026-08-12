import { redirect } from "next/navigation";
import { CLIENT_ROUTES } from "@/constants/routes";

export default function DashboardIndex() {
  redirect(CLIENT_ROUTES.PRICETABLE);
}
