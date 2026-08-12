/**
 * Sync the active credit pool from primary + backup CSVs (see csv-paths.ts).
 * Imports unredeemed codes, preserves active claims, and removes stale
 * unused credits that are not in the current exports.
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
import {
  resolveCreditPoolSources,
  type CreditPoolSource,
} from "./csv-paths";

const prisma = new PrismaClient();

const REDEEMED_STATUSES = new Set(["taken", "used", "redeemed", "claimed"]);

function isRedeemedInCsv(status?: string): boolean {
  return REDEEMED_STATUSES.has((status || "").trim().toLowerCase());
}

type PoolCredit = {
  code: string;
  link: string;
  redeemedInCsv: boolean;
  isBackup: boolean;
  /** Stable drain order across pools (primary first, then backups in list order). */
  order: number;
  source: string;
};

function loadPoolCredits(
  sources: CreditPoolSource[]
): Map<string, PoolCredit> {
  const map = new Map<string, PoolCredit>();
  let order = 0;

  for (const source of sources) {
    if (!existsSync(source.path)) {
      console.error(`❌ Credits file not found: ${source.path}`);
      process.exit(1);
    }

    const rows = parseCreditsCsv(readFileSync(source.path, "utf-8"));
    let inFile = 0;
    let unredeemed = 0;
    let redeemed = 0;

    for (const row of rows) {
      const link = (row.link || "").trim();
      if (!link) continue;

      const code = extractCode(link);
      if (!code) continue;

      inFile++;
      const redeemedInCsv = isRedeemedInCsv(row.status);
      if (redeemedInCsv) redeemed++;
      else unredeemed++;

      // Primary wins on duplicate codes; first backup wins over later backups.
      if (map.has(code)) continue;

      map.set(code, {
        code,
        link: normalizeCreditLink(link, code),
        redeemedInCsv,
        isBackup: source.isBackup,
        order: order++,
        source: source.label,
      });
    }

    const kind = source.isBackup ? "backup" : "primary";
    console.log(
      `   📄 [${kind}] ${source.label}: ${inFile} codes (${unredeemed} free, ${redeemed} hashed out)`
    );
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
  const sources = resolveCreditPoolSources();
  console.log("💳 Syncing credit pool (primary + backups)\n");
  for (const s of sources) {
    console.log(`   ${s.isBackup ? "🛟" : "⭐"} ${s.path}`);
  }
  if (freshTrack) console.log("   🆕 Mode: fresh track (no prior claims)");
  console.log();

  const poolCredits = loadPoolCredits(sources);
  if (poolCredits.size === 0) {
    console.error("❌ No credits found in CSVs.");
    process.exit(1);
  }

  const all = Array.from(poolCredits.values()).sort((a, b) => a.order - b.order);
  const unredeemedInCsv = all.filter((c) => !c.redeemedInCsv);
  const redeemedInCsv = all.filter((c) => c.redeemedInCsv);
  const primaryFree = unredeemedInCsv.filter((c) => !c.isBackup).length;
  const backupFree = unredeemedInCsv.filter((c) => c.isBackup).length;

  console.log(`\n   📄 Unique codes:              ${poolCredits.size}`);
  console.log(`   ✅ Unredeemed (claimable):     ${unredeemedInCsv.length}`);
  console.log(`      ⭐ Primary free:            ${primaryFree}`);
  console.log(`      🛟 Backup free:             ${backupFree}`);
  console.log(`   🚫 Marked redeemed / hashed:  ${redeemedInCsv.length}`);

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

  const poolCodes = all.map((c) => c.code);

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
        `   ℹ️  Kept ${assignedOutsidePool.length} claimed credits outside the new CSVs`
      );
    }
  }

  const importBatch = unredeemedInCsv.map((credit) => ({
    code: credit.code,
    link: credit.link,
    isUsed: false,
    isTest: false,
    isBackup: credit.isBackup,
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

  const unused = unredeemedInCsv.filter((c) => !usedCodes.has(c.code));

  if (unused.length > 0) {
    // Preserve sheet order within each pool; primary before backups via isBackup + createdAt.
    // Batch via a single SQL update so Neon doesn't drop a long per-row loop.
    const orderBase = Date.UTC(2026, 7, 12, 0, 0, 0);
    const valuesSql = unused
      .map((credit, i) => {
        const createdAt = new Date(orderBase + credit.order * 1000).toISOString();
        return `($${i * 3 + 1}, $${i * 3 + 2}::boolean, $${i * 3 + 3}::timestamptz)`;
      })
      .join(", ");
    const params = unused.flatMap((credit) => [
      credit.code,
      credit.isBackup,
      new Date(orderBase + credit.order * 1000).toISOString(),
    ]);

    await prisma.$executeRawUnsafe(
      `
      UPDATE "Credit" AS c
      SET
        "isUsed" = false,
        "isBackup" = v.is_backup,
        "assignedAt" = NULL,
        "createdAt" = v.created_at
      FROM (VALUES ${valuesSql}) AS v(code, is_backup, created_at)
      WHERE c.code = v.code AND c."isTest" = false
      `,
      ...params
    );
    console.log(`   ♻️  Ordered ${unused.length} claimable credits`);
  }

  if (usedCodes.size > 0) {
    const usedList = Array.from(usedCodes);
    const chunkSize = 200;
    for (let i = 0; i < usedList.length; i += chunkSize) {
      const chunk = usedList.slice(i, i + chunkSize);
      await prisma.credit.updateMany({
        where: { isTest: false, code: { in: chunk } },
        data: { isUsed: true },
      });
    }
    console.log(`   🚫 Marked ${usedList.length} codes used / hashed out`);
  }

  // Hashed-out codes that were never imported still need a row if we want
  // accurate "used" counts from CSV — optional; skipped rows stay out of DB.
  // Redeemed-only codes already in DB were marked used above.

  const after = {
    unusedReal: await prisma.credit.count({
      where: { isUsed: false, isTest: false },
    }),
    usedReal: await prisma.credit.count({
      where: { isUsed: true, isTest: false },
    }),
    unusedPrimary: await prisma.credit.count({
      where: { isUsed: false, isTest: false, isBackup: false },
    }),
    unusedBackup: await prisma.credit.count({
      where: { isUsed: false, isTest: false, isBackup: true },
    }),
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
  console.log(`      ⭐ Primary available:    ${after.unusedPrimary}`);
  console.log(`      🛟 Backup available:     ${after.unusedBackup}`);
  console.log(
    `   Used real credits:         ${before.usedReal} → ${after.usedReal}`
  );
  console.log(`   Approved guests:           ${eligible}`);
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
