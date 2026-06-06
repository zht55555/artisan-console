import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authCookies, createVisitorId } from "@/lib/auth";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST() {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get(authCookies.visitor)?.value;

  if (!visitorId) {
    visitorId = createVisitorId();
    cookieStore.set({
      name: authCookies.visitor,
      value: visitorId,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ONE_YEAR_SECONDS,
    });
  }

  return NextResponse.json({
    userId: visitorId,
    visitorId,
    mode: "anonymous",
  });
}
