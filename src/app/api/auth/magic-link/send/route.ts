import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  // Batch 1 only provides contract + validation; actual email delivery is done in auth integration batch.
  return NextResponse.json(
    {
      ok: true,
      message: "Magic link dispatch is pending Better Auth integration.",
      email: parsed.data.email,
    },
    { status: 202 },
  );
}
