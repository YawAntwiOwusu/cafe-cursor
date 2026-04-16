import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/** Prisma request errors when Postgres is unreachable (Neon suspended, network, wrong host). */
const CONNECTION_REQUEST_CODES = new Set([
  "P1001",
  "P1002",
  "P1017",
]);

export const DATABASE_UNAVAILABLE_MESSAGE =
  "Database is unreachable. If you use Neon, open the project in the Neon console to wake it, verify DATABASE_URL and DIRECT_URL in .env, then restart the dev server.";

export function isDatabaseConnectionError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    CONNECTION_REQUEST_CODES.has(error.code)
  ) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  return false;
}

export function jsonDatabaseUnavailable(
  body: Record<string, unknown> = {}
): NextResponse {
  return NextResponse.json(
    {
      ...body,
      error: DATABASE_UNAVAILABLE_MESSAGE,
      code: "DATABASE_UNAVAILABLE",
    },
    { status: 503 }
  );
}
