import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { promptTemplates } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractTemplateVariables } from "@/services/prompt-template";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  template: z.string().min(1).max(6000),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

  const rows = await db
    .select({
      id: promptTemplates.id,
      name: promptTemplates.name,
      description: promptTemplates.description,
      template: promptTemplates.template,
      variables: promptTemplates.variables,
      createdAt: promptTemplates.createdAt,
      updatedAt: promptTemplates.updatedAt,
    })
    .from(promptTemplates)
    .where(eq(promptTemplates.userId, userId))
    .orderBy(desc(promptTemplates.updatedAt));

  return NextResponse.json({ ok: true, templates: rows });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(payload);

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

  const now = new Date();
  const templateId = `pt_${crypto.randomUUID()}`;
  const variables = extractTemplateVariables(parsed.data.template);

  await db.insert(promptTemplates).values({
    id: templateId,
    userId,
    name: parsed.data.name,
    description: parsed.data.description,
    template: parsed.data.template,
    variables,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      ok: true,
      templateId,
      variables,
    },
    { status: 201 },
  );
}
