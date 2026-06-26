/**
 * Release orphaned credits (used but no assigned user) and import any
 * missing referral links from archived event CSVs.
 *
 *   npm run db:load-credits
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  parseCreditsCsv,
  extractCode,
  normalizeCreditLink,
} from "../lib/csv-import";

const prisma = new PrismaClient();

const CREDIT_CSV_FILES = [
  join(process.cwd(), "prisma", "Cursor Build Night Accra May.csv"),
  join(
    process.cwd(),
    "prisma/archive",
    "Café Cursor Accra April - 01.csv"
  ),
];

async function importMissingFromCsv(filepath: string) {
  if (!existsSync(filepath)) {
    console.log(`   ⚠️  Not found: ${filepath}`);
    return { file: filepath, created: 0, parsed: 0 };
  }

  const parsed = parseCreditsCsv(readFileSync(filepath, "utf-8"));
  const seenCodes = new Set<string>();
  const batch: {
    code: string;
    link: string;
    isUsed: boolean;
    isTest: boolean;
    assignedAt: Date | null;
  }[] = [];

  for (const row of parsed) {
    const link = (row.link || "").trim();
    if (!link) continue;

    const code = extractCode(link);
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);

    const isUsed = (row.status || "").toLowerCase() === "taken";
    batch.push({
      code,
      link: normalizeCreditLink(link, code),
      isUsed,
      isTest: false,
      assignedAt: isUsed ? new Date() : null,
    });
  }

  const result = await prisma.credit.createMany({
    data: batch,
    skipDuplicates: true,
  });

  return {
    file: filepath,
    parsed: parsed.length,
    created: result.count,
  };
}

async function main() {
  console.log("💳 Loading unused credits into the available pool\n");

  const before = {
    unusedReal: await prisma.credit.count({
      where: { isUsed: false, isTest: false },
    }),
    usedOrphan: await prisma.credit.count({
      where: { isUsed: true, isTest: false, assignedTo: { is: null } },
    }),
    total: await prisma.credit.count(),
  };

  console.log("📊 Before:");
  console.log(`   Unused real credits:  ${before.unusedReal}`);
  console.log(`   Orphaned (releasable): ${before.usedOrphan}`);

  console.log("\n🔓 Releasing orphaned credits (used but no assigned user)...");
  const released = await prisma.credit.updateMany({
    where: {
      isUsed: true,
      isTest: false,
      assignedTo: { is: null },
    },
    data: {
      isUsed: false,
      assignedAt: null,
    },
  });
  console.log(`   ✅ ${released.count} credits released`);

  console.log("\n📥 Importing missing credits from event CSVs...");
  let totalImported = 0;
  for (const file of CREDIT_CSV_FILES) {
    const result = await importMissingFromCsv(file);
    console.log(
      `   📄 ${result.file.split("/").slice(-2).join("/")}: ${result.created} new (${result.parsed} in file)`
    );
    totalImported += result.created;
  }

  const after = {
    unusedReal: await prisma.credit.count({
      where: { isUsed: false, isTest: false },
    }),
    usedReal: await prisma.credit.count({
      where: { isUsed: true, isTest: false },
    }),
    total: await prisma.credit.count(),
  };

  const eligible = await prisma.eligibleUser.count({
    where: {
      approvalStatus: "approved",
      email: {
        notIn: [
          "test@example.com",
          "test2@example.com",
          "test3@example.com",
          "test4@example.com",
          "test5@example.com",
        ],
      },
    },
  });
  const shortfall = Math.max(0, eligible - after.unusedReal);

  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));
  console.log(`   Released orphans:     ${released.count}`);
  console.log(`   New from CSV import:  ${totalImported}`);
  console.log(`   Unused real credits:  ${before.unusedReal} → ${after.unusedReal}`);
  console.log(`   Used real credits:    ${after.usedReal}`);
  console.log(`   Total credits in DB:  ${after.total}`);
  console.log(`   Approved guests:      ${eligible}`);
  if (shortfall > 0) {
    console.log(`   ⚠️  Shortfall: ${shortfall} guests may still not get a credit.`);
  }
  console.log("=".repeat(50));
  console.log("\n🎉 Done!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
