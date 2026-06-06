import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { conversations } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createConversationSchema = z.object({
  title: z.string().max(120).optional(),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parsed = createConversationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) {
    return jsonError(401, "unauthorized");
  }

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return jsonError(503, "database_not_configured");
  }

  const conversationId = `conv_${crypto.randomUUID()}`;
  const now = new Date();

  try {
    await db.insert(conversations).values({
      id: conversationId,
      userId,
      title: parsed.data.title ?? "新会话",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    return jsonError(503, "database_unavailable");
  }

  return NextResponse.json(
    {
      ok: true,
      conversationId,
      title: parsed.data.title ?? "新会话",
    },
    { status: 201 },
  );
}

export async function GET() {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) {
    return jsonError(401, "unauthorized");
  }

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return jsonError(503, "database_not_configured");
  }

  let items: (typeof conversations.$inferSelect)[] = [];
  try {
    items = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(30);
  } catch {
    return jsonError(503, "database_unavailable");
  }

  return NextResponse.json({ ok: true, items });
}
