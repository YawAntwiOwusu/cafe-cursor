/**
 * Replace all real eligible users with a new event guest CSV.
 * Credits are NOT touched — unused credits remain available for the new audience.
 *
 *   npm run db:switch-users
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { parseUsersCsv } from "../lib/csv-import";
import { resolveUsersPath } from "./csv-paths";

const prisma = new PrismaClient();

const TEST_USERS = [
  { email: "test@example.com", name: "Test User 1" },
  { email: "test2@example.com", name: "Test User 2" },
  { email: "test3@example.com", name: "Test User 3" },
  { email: "test4@example.com", name: "Test User 4" },
  { email: "test5@example.com", name: "Test User 5" },
];

const TEST_USER_EMAILS = TEST_USERS.map((u) => u.email.toLowerCase());

async function main() {
  const usersPath = resolveUsersPath();
  console.log("🔄 Switching eligible users to new event guest list\n");
  console.log(`   📄 ${usersPath}`);

  if (!existsSync(usersPath)) {
    console.error("❌ Guest CSV not found.");
    process.exit(1);
  }

  const rows = parseUsersCsv(readFileSync(usersPath, "utf-8"));
  const candidates: {
    email: string;
    name: string;
    company: string | null;
    role: string | null;
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
    });
  }

  if (candidates.length === 0) {
    console.error("❌ No approved rows with valid emails in CSV.");
    process.exit(1);
  }

  const creditsBefore = {
    total: await prisma.credit.count(),
    unusedReal: await prisma.credit.count({ where: { isUsed: false, isTest: false } }),
    used: await prisma.credit.count({ where: { isUsed: true } }),
  };

  console.log("\n🗑️  Removing non-test eligible users...");
  const deleted = await prisma.eligibleUser.deleteMany({
    where: { email: { notIn: TEST_USER_EMAILS } },
  });
  console.log(`   ✅ ${deleted.count} users removed`);

  console.log("\n👥 Loading new eligible users...");
  let usersCreated = 0;
  for (const c of candidates) {
    try {
      await prisma.eligibleUser.create({
        data: {
          email: c.email,
          name: c.name,
          company: c.company,
          role: c.role,
          approvalStatus: "approved",
          hasClaimed: false,
        },
      });
      usersCreated++;
    } catch {
      console.log(`   ⚠️  Skipping duplicate: ${c.email}`);
    }
  }
  console.log(`   ✅ ${usersCreated} eligible users created`);

  console.log("\n🧪 Ensuring test users exist...");
  let testUsersCreated = 0;
  for (const user of TEST_USERS) {
    const email = user.email.toLowerCase();
    const existing = await prisma.eligibleUser.findUnique({ where: { email } });
    if (existing) continue;

    await prisma.eligibleUser.create({
      data: {
        email,
        name: user.name,
        company: "Test Company",
        role: "Tester",
        approvalStatus: "approved",
        hasClaimed: false,
      },
    });
    testUsersCreated++;
  }
  console.log(`   ✅ ${testUsersCreated} test users created (${TEST_USERS.length - testUsersCreated} already existed)`);

  const creditsAfter = {
    total: await prisma.credit.count(),
    unusedReal: await prisma.credit.count({ where: { isUsed: false, isTest: false } }),
    used: await prisma.credit.count({ where: { isUsed: true } }),
  };

  const totalEligible = await prisma.eligibleUser.count({
    where: { approvalStatus: "approved", email: { notIn: TEST_USER_EMAILS } },
  });
  const shortfall = Math.max(0, totalEligible - creditsAfter.unusedReal);

  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));
  console.log(`   Users removed:        ${deleted.count}`);
  console.log(`   Users created:        ${usersCreated}`);
  console.log(`   Approved guests:      ${totalEligible}`);
  console.log(`   Credits (unchanged):  ${creditsAfter.total} total`);
  console.log(`   Unused real credits:  ${creditsAfter.unusedReal}`);
  console.log(`   Used credits:         ${creditsAfter.used}`);
  if (creditsBefore.total !== creditsAfter.total || creditsBefore.unusedReal !== creditsAfter.unusedReal) {
    console.log("   ⚠️  Credit counts changed unexpectedly — investigate.");
  }
  if (shortfall > 0) {
    console.log(`   ⚠️  Shortfall: ${shortfall} guests may not get a credit until more links are added.`);
  }
  console.log("=".repeat(50));
  console.log("\n🎉 User switch completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Switch error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
