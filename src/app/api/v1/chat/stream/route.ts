import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { conversations, messages } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createSseHeaders, formatSseEvent } from "@/lib/sse";
import { getAIClient, getChatModel } from "@/ai/client";

// Must run on Node.js runtime for streaming + AbortController wiring
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(8000),
  model: z.string().optional(),
});

/** Emit a properly-formatted SSE event line */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) {
    return new Response(formatSseEvent("error", { code: "unauthorized" }), {
      status: 401,
      headers: createSseHeaders(),
    });
  }

  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(
      formatSseEvent("error", {
        code: "invalid_request",
        issues: parsed.error.flatten(),
      }),
      { status: 400, headers: createSseHeaders() },
    );
  }

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch {
    return new Response(
      formatSseEvent("error", { code: "database_not_configured" }),
      { status: 503, headers: createSseHeaders() },
    );
  }

  // Verify ownership
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, parsed.data.conversationId),
        eq(conversations.userId, userId),
      ),
    )
    .limit(1);

  if (!conversation) {
    return new Response(
      formatSseEvent("error", { code: "conversation_not_found" }),
      { status: 404, headers: createSseHeaders() },
    );
  }

  // Multi-turn context: last 40 completed messages
  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        eq(messages.status, "done"),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(40);

  const now = new Date();
  const userMsgId = `msg_${crypto.randomUUID()}`;
  const asstMsgId = `msg_${crypto.randomUUID()}`;

  await db.insert(messages).values({
    id: userMsgId,
    conversationId: conversation.id,
    userId,
    role: "user",
    content: parsed.data.content,
    status: "done",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(messages).values({
    id: asstMsgId,
    conversationId: conversation.id,
    userId,
    role: "assistant",
    content: "",
    status: "streaming",
    createdAt: new Date(now.getTime() + 1),
    updatedAt: new Date(now.getTime() + 1),
  });

  const aiMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: "你是一个有帮助的 AI 助手，回答简洁、准确。" },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    { role: "user", content: parsed.data.content },
  ];

  const model = parsed.data.model ?? getChatModel();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 60000);

  let aiClient: ReturnType<typeof getAIClient>;
  try {
    aiClient = getAIClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI client init error";
    return new Response(
      formatSseEvent("error", { code: "ai_not_configured", message: msg }),
      { status: 503, headers: createSseHeaders() },
    );
  }

  // ── Abort signal: client disconnect + timeout ──────────────────────────────
  const clientSignal = request.signal;
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(() => timeoutCtrl.abort(), timeoutMs);

  const combinedCtrl = new AbortController();
  const abortCombined = () => combinedCtrl.abort();
  clientSignal.addEventListener("abort", abortCombined);
  timeoutCtrl.signal.addEventListener("abort", abortCombined);

  let finalStatus: "done" | "canceled" | "error" = "done";
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (chunk: string) => controller.enqueue(enc.encode(chunk));

      try {
        const aiStream = await aiClient.chat.completions.create(
          { model, messages: aiMessages, stream: true },
          { signal: combinedCtrl.signal },
        );

        for await (const chunk of aiStream) {
          if (combinedCtrl.signal.aborted) break;

          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            // Named SSE event: "token"
            emit(sseEvent("token", { delta }));
          }

          const fin = chunk.choices[0]?.finish_reason;
          if (fin === "stop" || fin === "length") break;
        }

        clearTimeout(timer);
        finalStatus = clientSignal.aborted ? "canceled" : "done";
      } catch (err) {
        clearTimeout(timer);
        const isAbort = err instanceof Error && err.name === "AbortError";

        if (isAbort && clientSignal.aborted) {
          finalStatus = "canceled";
          // client already knows — no event needed
        } else {
          finalStatus = "error";
          const code = isAbort ? "timeout" : "ai_error";
          const message = err instanceof Error ? err.message : "Unknown error";
          emit(sseEvent("error", { code, message }));
        }
      } finally {
        clientSignal.removeEventListener("abort", abortCombined);
        timeoutCtrl.signal.removeEventListener("abort", abortCombined);
      }

      // Persist final state to DB
      await db.update(messages).set({
        content: fullContent,
        status: finalStatus,
        tokenCount: fullContent.length,
        updatedAt: new Date(),
      }).where(and(eq(messages.id, asstMsgId), eq(messages.userId, userId)));

      await db.update(conversations).set({
        updatedAt: new Date(),
      }).where(and(eq(conversations.id, conversation.id), eq(conversations.userId, userId)));

      // Named SSE event: "done"
      emit(sseEvent("done", { messageId: asstMsgId, length: fullContent.length }));
      controller.close();
    },
  });

  return new Response(stream, { headers: createSseHeaders() });
}
