import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { conversations, generationTasks } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "all";

  const [chatItems, imageItems, editItems, videoItems] = await Promise.all([
    db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(50),

    db
      .select({
        id: generationTasks.id,
        prompt: generationTasks.prompt,
        status: generationTasks.status,
        createdAt: generationTasks.createdAt,
        updatedAt: generationTasks.updatedAt,
      })
      .from(generationTasks)
      .where(
        and(
          eq(generationTasks.userId, userId),
          eq(generationTasks.type, "text_to_image"),
        ),
      )
      .orderBy(desc(generationTasks.updatedAt))
      .limit(50),

    db
      .select({
        id: generationTasks.id,
        prompt: generationTasks.prompt,
        status: generationTasks.status,
        createdAt: generationTasks.createdAt,
        updatedAt: generationTasks.updatedAt,
      })
      .from(generationTasks)
      .where(
        and(
          eq(generationTasks.userId, userId),
          eq(generationTasks.type, "image_edit"),
        ),
      )
      .orderBy(desc(generationTasks.updatedAt))
      .limit(50),

    db
      .select({
        id: generationTasks.id,
        prompt: generationTasks.prompt,
        status: generationTasks.status,
        createdAt: generationTasks.createdAt,
        updatedAt: generationTasks.updatedAt,
      })
      .from(generationTasks)
      .where(
        and(
          eq(generationTasks.userId, userId),
          eq(generationTasks.type, "text_to_video"),
        ),
      )
      .orderBy(desc(generationTasks.updatedAt))
      .limit(50),
  ]);

  const items = [
    ...chatItems.map((item) => ({
      type: "chat" as const,
      id: item.id,
      title: item.title || "未命名会话",
      status: "done",
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
    })),
    ...imageItems.map((item) => ({
      type: "image" as const,
      id: item.id,
      title: item.prompt,
      status: item.status,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
    })),
    ...editItems.map((item) => ({
      type: "edit" as const,
      id: item.id,
      title: item.prompt,
      status: item.status,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
    })),
    ...videoItems.map((item) => ({
      type: "video" as const,
      id: item.id,
      title: item.prompt,
      status: item.status,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
    })),
  ]
    .filter((item) => (type === "all" ? true : item.type === type))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 100);

  return NextResponse.json({
    ok: true,
    type,
    items,
  });
}
