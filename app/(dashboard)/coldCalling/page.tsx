import { CLIENT_ROUTES } from "@/constants/routes";
import Link from "next/link";

export default function ColdCallingPage() {
  return (
    <div>
      <div className="flex flex-row justify-between">
        <div>
          <h1>Cold Calling</h1>

          <div className="flex flex-row gap-2">
            <select>
              <option>Elliot</option>
            </select>

            <select>
              <option>Ringeliste</option>
            </select>
          </div>

          <input type="text" placeholder="Søk etter navn eller beskrivelse" />
        </div>

        <div className="w-128 h-32 bg-red-500"></div>

        <div className="flex flex-col gap-2">
          <Link href={CLIENT_ROUTES.COLD_CALLING + "/import"}>Importer</Link>
          <button>Flytt</button>
        </div>
      </div>
    </div>
  );
}
