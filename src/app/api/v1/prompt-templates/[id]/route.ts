import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { promptTemplates } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractTemplateVariables } from "@/services/prompt-template";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  template: z.string().min(1).max(6000).optional(),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getAuthContext() {
  const { userId } = await getCurrentUserOrThrow().catch(() => ({
    userId: null,
  }));
  if (!userId) {
    return { userId: null, db: null as ReturnType<typeof getDb> | null };
  }

  try {
    const db = getDb();
    return { userId, db };
  } catch {
    return { userId, db: null as ReturnType<typeof getDb> | null };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { userId, db } = await getAuthContext();

  if (!userId) {
    return jsonError(401, "unauthorized");
  }

  if (!db) {
    return jsonError(503, "database_not_configured");
  }

  const [row] = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)))
    .limit(1);

  if (!row) {
    return jsonError(404, "template_not_found");
  }

  return NextResponse.json({ ok: true, template: row });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await request.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(payload);

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

  if (Object.keys(parsed.data).length === 0) {
    return jsonError(400, "empty_patch");
  }

  const { id } = await context.params;
  const { userId, db } = await getAuthContext();

  if (!userId) {
    return jsonError(401, "unauthorized");
  }

  if (!db) {
    return jsonError(503, "database_not_configured");
  }

  const [existing] = await db
    .select({ id: promptTemplates.id, template: promptTemplates.template })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)))
    .limit(1);

  if (!existing) {
    return jsonError(404, "template_not_found");
  }

  const nextTemplate = parsed.data.template ?? existing.template;
  const values = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.description !== undefined
      ? { description: parsed.data.description ?? null }
      : {}),
    ...(parsed.data.template !== undefined
      ? { template: parsed.data.template }
      : {}),
    variables: extractTemplateVariables(nextTemplate),
    updatedAt: new Date(),
  };

  await db
    .update(promptTemplates)
    .set(values)
    .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)));

  return NextResponse.json({ ok: true, id, variables: values.variables });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { userId, db } = await getAuthContext();

  if (!userId) {
    return jsonError(401, "unauthorized");
  }

  if (!db) {
    return jsonError(503, "database_not_configured");
  }

  const [existing] = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)))
    .limit(1);

  if (!existing) {
    return jsonError(404, "template_not_found");
  }

  await db
    .delete(promptTemplates)
    .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)));

  return NextResponse.json({ ok: true, id });
}
