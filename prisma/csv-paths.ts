import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const prismaDir = () => join(process.cwd(), "prisma");

/**
 * Edit these when you drop a new event export into prisma/.
 *
 * Archived guests (stored in prisma/archive/):
 *   - April 2026 Café Cursor Accra guests
 *   - May 2026 Cursor Build Night Accra guests
 *   - June 2026 Cursor Hackathon UCC guests
 *   - Aug 12 morning — Cursor Meetup Accra Guests
 *
 * Active (Aug 12 afternoon — Cursor Ghana Meetup Builders Day):
 *   Guests  — "Cursor Meetup Accra - Guests - Afternoon Session.csv"
 *   Credits — "Accra Meetup Build Session Ghana #2.csv" (primary, full sheet)
 */
const CREDITS_EVENT_BASENAME = "Accra Meetup Build Session Ghana #2.csv";
const BACKUP_CREDITS_BASENAMES: string[] = [];
const USERS_EVENT_BASENAME =
  "Cursor Meetup Accra - Guests - Afternoon Session.csv";

export type CreditPoolSource = {
  label: string;
  path: string;
  /** Primary pool is claimed first; backups drain only after primary is empty. */
  isBackup: boolean;
};

export function resolveCreditsPath(): string {
  const dir = prismaDir();
  const event = join(dir, CREDITS_EVENT_BASENAME);
  if (existsSync(event)) return event;
  const fallback = join(dir, "credits.csv");
  if (existsSync(fallback)) return fallback;
  return join(dir, "credits-example.csv");
}

/**
 * Primary + backup credit CSVs in drain order.
 * Missing backup files are skipped with a warning from the loader.
 */
export function resolveCreditPoolSources(): CreditPoolSource[] {
  const dir = prismaDir();
  const sources: CreditPoolSource[] = [
    {
      label: "primary",
      path: resolveCreditsPath(),
      isBackup: false,
    },
  ];

  for (const basename of BACKUP_CREDITS_BASENAMES) {
    const path = join(dir, basename);
    if (!existsSync(path)) {
      // macOS NFD/NFC filename quirks — try a loose match
      const match = findByBasenameLoose(dir, basename);
      if (match) {
        sources.push({ label: basename, path: match, isBackup: true });
      }
      continue;
    }
    sources.push({ label: basename, path, isBackup: true });
  }

  return sources;
}

function findByBasenameLoose(dir: string, basename: string): string | null {
  try {
    const target = basename.normalize("NFC").toLowerCase();
    for (const f of readdirSync(dir)) {
      if (f.normalize("NFC").toLowerCase() === target) {
        return join(dir, f);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
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
