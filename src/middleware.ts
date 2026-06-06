import { NextResponse, type NextRequest } from "next/server";
import { authCookies, createVisitorId } from "@/lib/auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
  const existingVisitorId = request.cookies.get(authCookies.visitor)?.value;
  if (existingVisitorId) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set({
    name: authCookies.visitor,
    value: createVisitorId(),
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
