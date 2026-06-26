/**
 * Sync the active credit pool from the event CSV (see csv-paths.ts).
 * Imports unredeemed codes, preserves active claims, and removes stale
 * unused credits that are not in the current export.
 *
 *   npm run db:load-credits
 *   npm run db:load-credits -- --fresh   # reset all guest claims, fresh pool
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import {
  parseCreditsCsv,
  extractCode,
  normalizeCreditLink,
} from "../lib/csv-import";
import { resolveCreditsPath } from "./csv-paths";

const prisma = new PrismaClient();

const REDEEMED_STATUSES = new Set(["taken", "used", "redeemed", "claimed"]);

function isRedeemedInCsv(status?: string): boolean {
  return REDEEMED_STATUSES.has((status || "").trim().toLowerCase());
}

type PoolCredit = {
  code: string;
  link: string;
  redeemedInCsv: boolean;
};

function loadPoolCredits(filepath: string): Map<string, PoolCredit> {
  const map = new Map<string, PoolCredit>();

  if (!existsSync(filepath)) {
    console.error(`❌ Credits file not found: ${filepath}`);
    process.exit(1);
  }

  const rows = parseCreditsCsv(readFileSync(filepath, "utf-8"));
  for (const row of rows) {
    const link = (row.link || "").trim();
    if (!link) continue;

    const code = extractCode(link);
    if (!code) continue;

    map.set(code, {
      code,
      link: normalizeCreditLink(link, code),
      redeemedInCsv: isRedeemedInCsv(row.status),
    });
  }

  return map;
}

async function resetTrack(poolCodes: string[]) {
  console.log("\n🔄 Fresh track — clearing all guest claims and old credits...");

  const claimsCleared = await prisma.eligibleUser.updateMany({
    data: { hasClaimed: false, claimedAt: null, creditId: null },
  });
  console.log(`   ✅ ${claimsCleared.count} guest records reset`);

  const removed = await prisma.credit.deleteMany({
    where: { isTest: false, code: { notIn: poolCodes } },
  });
  console.log(`   🗑️  ${removed.count} old real credits removed`);

  await prisma.credit.updateMany({
    where: { isTest: false, code: { in: poolCodes } },
    data: { isUsed: false, assignedAt: null },
  });
  console.log(`   ♻️  ${poolCodes.length} pool credits marked available`);
}

async function main() {
  const freshTrack = process.argv.includes("--fresh");
  const creditsPath = resolveCreditsPath();
  console.log("💳 Syncing credit pool\n");
  console.log(`   📄 ${creditsPath}`);
  if (freshTrack) console.log("   🆕 Mode: fresh track (no prior claims)");
  console.log();


  const poolCredits = loadPoolCredits(creditsPath);
  if (poolCredits.size === 0) {
    console.error("❌ No credits found in CSV.");
    process.exit(1);
  }

  const unredeemedInCsv = [...poolCredits.values()].filter(
    (c) => !c.redeemedInCsv
  );
  const redeemedInCsv = [...poolCredits.values()].filter(
    (c) => c.redeemedInCsv
  );

  console.log(`   📄 Codes in CSV:            ${poolCredits.size}`);
  console.log(`   ✅ Unredeemed in CSV:       ${unredeemedInCsv.length}`);
  console.log(`   🚫 Marked redeemed in CSV: ${redeemedInCsv.length}`);

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

  const poolCodes = [...poolCredits.keys()];

  if (freshTrack) {
    await resetTrack(poolCodes);
  } else {
    const assignedOutsidePool = await prisma.credit.findMany({
      where: {
        isTest: false,
        assignedTo: { isNot: null },
        code: { notIn: poolCodes },
      },
      select: { code: true },
    });

    const removed = await prisma.credit.deleteMany({
      where: {
        isTest: false,
        code: { notIn: poolCodes },
        assignedTo: { is: null },
      },
    });
    if (removed.count > 0) {
      console.log(`\n🗑️  Removed ${removed.count} stale unused credits`);
    }
    if (assignedOutsidePool.length > 0) {
      console.log(
        `   ℹ️  Kept ${assignedOutsidePool.length} claimed credits outside the new CSV`
      );
    }
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
  console.log(`\n📥 Imported ${importResult.count} new codes`);

  const usedCodes = new Set<string>(redeemedInCsv.map((c) => c.code));

  if (!freshTrack) {
    const activeClaims = await prisma.credit.findMany({
      where: { isTest: false, assignedTo: { isNot: null } },
      select: { code: true },
    });
    for (const c of activeClaims) {
      usedCodes.add(c.code);
    }
  }

  const unusedCodes = poolCodes.filter((code) => !usedCodes.has(code));

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

  const inPoolUnused = await prisma.credit.count({
    where: { isTest: false, isUsed: false, code: { in: poolCodes } },
  });

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
  const claimedGuests = await prisma.eligibleUser.count({
    where: { hasClaimed: true },
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
  console.log(`   Available from new CSV:    ${inPoolUnused}`);
  console.log(`   Approved UCC guests:       ${eligible}`);
  console.log(`   Guests who claimed:        ${claimedGuests}`);
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
