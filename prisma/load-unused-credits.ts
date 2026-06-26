/**
 * Sync credit pool from Cafe Cursor + Build Night CSVs — unredeemed only.
 * Does NOT re-release orphaned credits.
 *
 * Build Night redemption is inferred from seed order: credits were claimed
 * FIFO by id when createdAt ties, so the first 88 of 151 were used at the
 * May event; the remaining 63 Build Night codes stay available.
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

const BUILD_NIGHT_REDEEMED_COUNT = 88;

const CREDIT_CSV_FILES = [
  {
    label: "Build Night",
    path: join(process.cwd(), "prisma", "Cursor Build Night Accra May.csv"),
  },
  {
    label: "Cafe Cursor",
    path: join(
      process.cwd(),
      "prisma/archive",
      "Café Cursor Accra April - 01.csv"
    ),
  },
];

const REDEEMED_STATUSES = new Set(["taken", "used", "redeemed", "claimed"]);

function isRedeemedInCsv(status?: string): boolean {
  return REDEEMED_STATUSES.has((status || "").trim().toLowerCase());
}

type EventCredit = {
  code: string;
  link: string;
  event: string;
  redeemedInCsv: boolean;
};

function loadEventCredits(): Map<string, EventCredit> {
  const map = new Map<string, EventCredit>();

  for (const file of CREDIT_CSV_FILES) {
    if (!existsSync(file.path)) {
      console.log(`   ⚠️  Not found: ${file.path}`);
      continue;
    }

    const rows = parseCreditsCsv(readFileSync(file.path, "utf-8"));
    for (const row of rows) {
      const link = (row.link || "").trim();
      if (!link) continue;

      const code = extractCode(link);
      if (!code) continue;

      map.set(code, {
        code,
        link: normalizeCreditLink(link, code),
        event: file.label,
        redeemedInCsv: isRedeemedInCsv(row.status),
      });
    }
  }

  return map;
}

async function buildNightRedeemedCodes(
  bnCodes: Set<string>
): Promise<Set<string>> {
  const bnCredits = await prisma.credit.findMany({
    where: { isTest: false, code: { in: [...bnCodes] } },
    select: { code: true },
    orderBy: { id: "asc" },
  });

  return new Set(
    bnCredits.slice(0, BUILD_NIGHT_REDEEMED_COUNT).map((c) => c.code)
  );
}

async function main() {
  console.log("💳 Syncing unredeemed credits (Cafe Cursor + Build Night only)\n");

  const eventCredits = loadEventCredits();
  if (eventCredits.size === 0) {
    console.error("❌ No credits found in event CSV files.");
    process.exit(1);
  }

  const unredeemedInCsv = [...eventCredits.values()].filter(
    (c) => !c.redeemedInCsv
  );
  const redeemedInCsv = [...eventCredits.values()].filter(
    (c) => c.redeemedInCsv
  );

  const bnCodes = new Set(
    [...eventCredits.values()]
      .filter((c) => c.event === "Build Night")
      .map((c) => c.code)
  );
  const buildNightRedeemed = await buildNightRedeemedCodes(bnCodes);

  console.log(`   📄 Event codes in CSVs:     ${eventCredits.size}`);
  console.log(`   ✅ Unredeemed in CSV:       ${unredeemedInCsv.length}`);
  console.log(`   🚫 Marked redeemed in CSV: ${redeemedInCsv.length}`);
  console.log(
    `   🔒 Build Night used at event: ${buildNightRedeemed.size} (first ${BUILD_NIGHT_REDEEMED_COUNT} by seed order)`
  );

  const before = {
    unusedReal: await prisma.credit.count({
      where: { isUsed: false, isTest: false },
    }),
    usedReal: await prisma.credit.count({
      where: { isUsed: true, isTest: false },
    }),
  };

  console.log("\n📊 Before:");
  console.log(`   Unused real credits: ${before.unusedReal}`);
  console.log(`   Used real credits:   ${before.usedReal}`);

  const eventCodes = [...eventCredits.keys()];

  const removed = await prisma.credit.deleteMany({
    where: { isTest: false, code: { notIn: eventCodes } },
  });
  if (removed.count > 0) {
    console.log(`\n🗑️  Removed ${removed.count} credits outside event CSVs`);
  }

  const importBatch = unredeemedInCsv.map((credit) => ({
    code: credit.code,
    link: credit.link,
    isUsed: false,
    isTest: false,
    assignedAt: null as Date | null,
  }));

  const importResult = await prisma.credit.createMany({
    data: importBatch,
    skipDuplicates: true,
  });
  console.log(`\n📥 Imported ${importResult.count} missing unredeemed codes`);

  const usedCodes = new Set<string>([
    ...redeemedInCsv.map((c) => c.code),
    ...buildNightRedeemed,
  ]);

  const activeClaims = await prisma.credit.findMany({
    where: { isTest: false, assignedTo: { isNot: null } },
    select: { code: true },
  });
  for (const c of activeClaims) {
    usedCodes.add(c.code);
  }

  const unusedCodes = [...eventCredits.keys()].filter(
    (code) => !usedCodes.has(code)
  );

  if (unusedCodes.length > 0) {
    await prisma.credit.updateMany({
      where: { isTest: false, code: { in: unusedCodes } },
      data: { isUsed: false, assignedAt: null },
    });
  }

  if (usedCodes.size > 0) {
    await prisma.credit.updateMany({
      where: { isTest: false, code: { in: [...usedCodes] } },
      data: { isUsed: true },
    });
  }

  const after = {
    unusedReal: await prisma.credit.count({
      where: { isUsed: false, isTest: false },
    }),
    usedReal: await prisma.credit.count({
      where: { isUsed: true, isTest: false },
    }),
  };

  const dbCredits = await prisma.credit.findMany({
    where: { isTest: false },
    select: { code: true, isUsed: true },
  });

  const byEvent = {
    buildNight: { unused: 0, used: 0 },
    cafeCursor: { unused: 0, used: 0 },
  };
  for (const c of dbCredits) {
    const bucket = bnCodes.has(c.code) ? "buildNight" : "cafeCursor";
    if (c.isUsed) byEvent[bucket].used++;
    else byEvent[bucket].unused++;
  }

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
  console.log(
    `   Unused real credits:       ${before.unusedReal} → ${after.unusedReal}`
  );
  console.log(
    `   Used real credits:         ${before.usedReal} → ${after.usedReal}`
  );
  console.log(
    `   Build Night  (unused/used): ${byEvent.buildNight.unused} / ${byEvent.buildNight.used}`
  );
  console.log(
    `   Cafe Cursor  (unused/used): ${byEvent.cafeCursor.unused} / ${byEvent.cafeCursor.used}`
  );
  console.log(`   Approved UCC guests:       ${eligible}`);
  if (shortfall > 0) {
    console.log(`   ⚠️  Shortfall: ${shortfall} guests may not get a credit.`);
  }
  console.log("=".repeat(50));
  console.log("\n🎉 Sync completed!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
