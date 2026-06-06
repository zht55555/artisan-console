import { NextResponse } from "next/server";
import postgres from "postgres";
import { getEnvCheck } from "@/lib/env";
import { getDatabaseUrl } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DatabaseCheck =
  | { status: "ok"; latencyMs: number }
  | { status: "not_configured" }
  | { status: "error"; message: string };

async function checkDatabase(
  databaseUrl: string | undefined,
): Promise<DatabaseCheck> {
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    return { status: "not_configured" };
  }

  const startedAt = Date.now();
  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 12,
    idle_timeout: 2,
    prepare: false,
  });

  try {
    await sql`select 1 as ok`;
    return {
      status: "ok",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown database error";
    return {
      status: "error",
      message,
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function GET() {
  const env = getEnvCheck();
  const database = await checkDatabase(getDatabaseUrl() ?? undefined);

  const ok = env.missingRequired.length === 0 && database.status === "ok";
  const statusCode = ok ? 200 : 503;

  return NextResponse.json(
    {
      ok,
      service: "artisan",
      timestamp: new Date().toISOString(),
      checks: {
        env: {
          ok: env.missingRequired.length === 0,
          missingRequired: env.missingRequired,
        },
        database,
        storage: {
          enabled: env.storageEnabled,
          missingOptional: env.missingOptionalStorage,
          strategy: env.storageEnabled
            ? "bucket_storage"
            : "provider_temporary_url",
        },
      },
    },
    { status: statusCode },
  );
}
