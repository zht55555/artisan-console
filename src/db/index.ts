import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

function normalizeDatabaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Allow accidental quoted env values like 'postgres://...'
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function getDatabaseUrl(): string | null {
  return normalizeDatabaseUrl(process.env.DATABASE_URL);
}

export function getDb() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (database) {
    return database;
  }

  const client = postgres(databaseUrl, {
    max: 5,
    connect_timeout: 12,
    idle_timeout: 20,
    prepare: false,
  });

  database = drizzle(client, { schema });
  return database;
}
