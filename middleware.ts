import { NextRequest, NextResponse } from "next/server";
import { CLIENT_ROUTES } from "@/constants/routes";

const AUTH_COOKIE = "sk_auth";

// NB: sk_auth er kun et UX-signal for å unngå unødvendige innloggingsflash,
// ikke en sikkerhetsgrense. Faktisk autorisasjon skjer via Bearer-token i API-rutene.
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isAuthed = req.cookies.get(AUTH_COOKIE)?.value === "1";
  if (isAuthed) {
    return NextResponse.next();
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = CLIENT_ROUTES.AUTH;
  redirectUrl.search = "";
  redirectUrl.searchParams.set("redirect", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
