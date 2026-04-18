/**
 * Upsert eligible users from the resolved guest-list CSV.
 * Does not delete credits or other rows — safe to run against a live DB.
 *
 *   npm run db:sync-users
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { parseUsersCsv } from "../lib/csv-import";
import { resolveUsersPath } from "./csv-paths";

const prisma = new PrismaClient();

async function main() {
  const usersPath = resolveUsersPath();
  console.log("📄 Using guest list:", usersPath);

  if (!existsSync(usersPath)) {
    console.error("❌ File not found.");
    process.exit(1);
  }

  const rows = parseUsersCsv(readFileSync(usersPath, "utf-8"));
  const candidates: {
    email: string;
    name: string;
    company: string | null;
    role: string | null;
    approvalStatus: string;
  }[] = [];

  for (const row of rows) {
    const email = (row.email || "").toLowerCase().trim();
    const status = (row.approval_status || row.status || "approved").trim();
    if (!email || !email.includes("@")) continue;
    if (status.toLowerCase() !== "approved") continue;

    candidates.push({
      email,
      name: (row.name || "Unknown").trim() || "Unknown",
      company: row.company?.trim() || null,
      role: row.role?.trim() || null,
      approvalStatus: "approved",
    });
  }

  if (candidates.length === 0) {
    console.log("⚠️  No approved rows with valid emails — nothing to sync.");
    return;
  }

  const existing = await prisma.eligibleUser.findMany({ select: { email: true } });
  const existingSet = new Set(existing.map((e) => e.email.toLowerCase()));

  await prisma.$transaction(
    candidates.map((c) =>
      prisma.eligibleUser.upsert({
        where: { email: c.email },
        create: {
          email: c.email,
          name: c.name,
          company: c.company,
          role: c.role,
          approvalStatus: c.approvalStatus,
          hasClaimed: false,
        },
        update: {
          name: c.name,
          company: c.company,
          role: c.role,
          approvalStatus: c.approvalStatus,
        },
      })
    )
  );

  const created = candidates.filter((c) => !existingSet.has(c.email)).length;
  const updated = candidates.length - created;

  console.log(`✅ Synced ${candidates.length} approved guests (${created} created, ${updated} updated).`);
}

main()
  .catch((e) => {
    console.error("❌ Sync error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
