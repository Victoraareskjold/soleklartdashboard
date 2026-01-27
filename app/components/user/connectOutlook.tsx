"use client";
import { useRouter } from "next/navigation";

export default function ConnectOutlook() {
  const router = useRouter();

  const connectOutlook = () => {
    const clientId = process.env.NEXT_PUBLIC_OUTLOOK_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_OUTLOOK_REDIRECT_URI;
    const scope =
      "openid profile email offline_access Mail.ReadWrite Mail.Send";

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${encodeURIComponent(
      scope,
    )}&response_mode=query&state=outlook`;

    router.push(authUrl);
  };

  return (
    <div>
      <button
        onClick={connectOutlook}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
      >
        Koble til Outlook
      </button>
    </div>
  );
}
