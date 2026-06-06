import { cookies } from "next/headers";

const VISITOR_COOKIE = "visitor_id";

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export function createVisitorId(): string {
  return `v_${crypto.randomUUID()}`;
}

export function parseUserIdFromHeader(value: string | null): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

export async function getCurrentUserIdOptional(): Promise<string | null> {
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  return visitorId ?? null;
}

export async function getCurrentUserOrThrow(): Promise<{ userId: string }> {
  const userId = await getCurrentUserIdOptional();
  if (!userId) {
    throw new AuthError("Unauthorized", 401);
  }
  return { userId };
}

export const authCookies = {
  visitor: VISITOR_COOKIE,
};
