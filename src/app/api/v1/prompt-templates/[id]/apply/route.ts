import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { promptTemplates } from "@/db/schema";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { applyTemplateVariables } from "@/services/prompt-template";

const applyTemplateSchema = z.object({
  values: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
});

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const payload = await request.json().catch(() => null);
  const parsed = applyTemplateSchema.safeParse(payload);

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

  const { id } = await context.params;

  const [row] = await db
    .select({
      id: promptTemplates.id,
      template: promptTemplates.template,
      variables: promptTemplates.variables,
    })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)))
    .limit(1);

  if (!row) {
    return jsonError(404, "template_not_found");
  }

  const result = applyTemplateVariables(row.template, parsed.data.values);

  return NextResponse.json({
    ok: true,
    templateId: row.id,
    renderedPrompt: result.rendered,
    missingVariables: result.missingVariables,
    variables: row.variables,
  });
}
