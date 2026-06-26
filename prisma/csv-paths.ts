import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const prismaDir = () => join(process.cwd(), "prisma");

/**
 * Edit these when you drop a new event export into prisma/.
 *
 * Archived (April 2026 — Cafe Cursor Accra):
 *   - "Café Cursor Accra April - 01.csv"
 *   - "Café Cursor Accra - Guests - 2026-04-18-03-49-59 - Café Cursor Accra - Guests - 2026-04-18-03-49-59.csv"
 *
 * Archived (May 2026 — Cursor Build Night Accra):
 *   - "Cursor Build Night Accra May.csv"
 *   - "Cursor Build Night Accra - Guests - 2026-05-30-16-27-38.csv"
 *
 * Archived (June 2026 — prior UCC pool: Build Night + Cafe Cursor):
 *   - "Cursor Build Night Accra May.csv"
 *   - "Café Cursor Accra April - 01.csv" (in prisma/archive/)
 *
 * (stored in prisma/archive/)
 */
const CREDITS_EVENT_BASENAME = "Cursor Hackathon UCC June.csv";
const USERS_EVENT_BASENAME =
  "Cursor Hackathon UCC - Guests - 2026-06-26-20-48-18.csv";

export function resolveCreditsPath(): string {
  const dir = prismaDir();
  const event = join(dir, CREDITS_EVENT_BASENAME);
  if (existsSync(event)) return event;
  const fallback = join(dir, "credits.csv");
  if (existsSync(fallback)) return fallback;
  return join(dir, "credits-example.csv");
}

/**
 * Resolves the guest-list CSV: preferred basename, else newest *Guests*.csv in prisma/,
 * else users.csv / example. Handles macOS Unicode normalization quirks on filenames.
 */
export function resolveUsersPath(): string {
  const dir = prismaDir();
  const event = join(dir, USERS_EVENT_BASENAME);
  if (existsSync(event)) return event;

  let files: string[] = [];
  try {
    files = readdirSync(dir);
  } catch {
    return join(dir, "users-example.csv");
  }

  const guestExports = files.filter(
    (f) => /guests/i.test(f) && f.endsWith(".csv") && !/example/i.test(f)
  );
  if (guestExports.length > 0) {
    const sorted = [...guestExports].sort(
      (a, b) =>
        statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs
    );
    return join(dir, sorted[0]);
  }

  const usersCsv = join(dir, "users.csv");
  if (existsSync(usersCsv)) return usersCsv;
  return join(dir, "users-example.csv");
}
