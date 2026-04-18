import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import {
  parseCreditsCsv,
  parseUsersCsv,
  extractCode,
  normalizeCreditLink,
} from "../lib/csv-import";
import { resolveCreditsPath, resolveUsersPath } from "./csv-paths";

const prisma = new PrismaClient();

function loadCreditRowsFromFile(filepath: string) {
  if (!existsSync(filepath)) {
    console.log(`   ⚠️  File not found: ${filepath}`);
    return [];
  }
  return parseCreditsCsv(readFileSync(filepath, "utf-8"));
}

function loadUsersRowsFromFile(filepath: string): Record<string, string>[] {
  if (!existsSync(filepath)) {
    console.log(`   ⚠️  File not found: ${filepath}`);
    return [];
  }
  return parseUsersCsv(readFileSync(filepath, "utf-8"));
}

// Test data for development
const TEST_CREDITS = [
  "TEST-CREDIT-001-DEMO",
  "TEST-CREDIT-002-DEMO",
  "TEST-CREDIT-003-DEMO",
  "TEST-CREDIT-004-DEMO",
  "TEST-CREDIT-005-DEMO",
];

const TEST_USERS = [
  { email: "test@example.com", name: "Test User 1" },
  { email: "test2@example.com", name: "Test User 2" },
  { email: "test3@example.com", name: "Test User 3" },
  { email: "test4@example.com", name: "Test User 4" },
  { email: "test5@example.com", name: "Test User 5" },
];

/**
 * Main seed function
 */
async function main() {
  console.log("🌱 Starting Cafe Cursor Accra database seed...\n");

  // Clean existing data
  console.log("🗑️  Cleaning existing data...");
  await prisma.eligibleUser.deleteMany();
  await prisma.credit.deleteMany();

  // ============================================
  // 1. LOAD CREDITS FROM CSV
  // ============================================
  console.log("\n📦 Loading credits...");

  const creditsPath = resolveCreditsPath();
  console.log(`   📄 ${creditsPath}`);
  const creditsData = loadCreditRowsFromFile(creditsPath);

  let creditsCreated = 0;

  for (const row of creditsData) {
    const link = row.link || "";
    if (!link) continue;

    const code = extractCode(link);
    const isUsed = (row.status || "").toLowerCase() === "taken";

    try {
      await prisma.credit.create({
        data: {
          code,
          link: normalizeCreditLink(link, code),
          isUsed,
          isTest: false,
          assignedAt: isUsed ? new Date() : null,
        },
      });
      creditsCreated++;
    } catch (e) {
      console.log(`   ⚠️  Skipping duplicate: ${code}`);
    }
  }

  console.log(`   ✅ ${creditsCreated} credits loaded from CSV`);

  // ============================================
  // 2. CREATE TEST CREDITS
  // ============================================
  console.log("\n🧪 Creating test credits...");

  for (const code of TEST_CREDITS) {
    await prisma.credit.create({
      data: {
        code,
        link: `https://cursor.com/referral?code=${code}`,
        isUsed: false,
        isTest: true,
      },
    });
  }

  console.log(`   ✅ ${TEST_CREDITS.length} test credits created`);

  // ============================================
  // 3. LOAD ELIGIBLE USERS FROM CSV
  // ============================================
  console.log("\n👥 Loading eligible users...");

  const usersPath = resolveUsersPath();
  console.log(`   📄 ${usersPath}`);
  const usersData = loadUsersRowsFromFile(usersPath);

  let usersCreated = 0;

  for (const row of usersData) {
    const email = (row.email || "").toLowerCase().trim();
    const name = row.name || "Unknown";
    const status = row.approval_status || row.status || "approved";

    if (!email || !email.includes("@")) continue;
    if (status.toLowerCase() !== "approved") continue;

    try {
      await prisma.eligibleUser.create({
        data: {
          email,
          name,
          company: row.company || null,
          role: row.role || null,
          approvalStatus: "approved",
          hasClaimed: false,
        },
      });
      usersCreated++;
    } catch (e) {
      console.log(`   ⚠️  Skipping duplicate: ${email}`);
    }
  }

  console.log(`   ✅ ${usersCreated} eligible users loaded from CSV`);

  // ============================================
  // 4. CREATE TEST USERS
  // ============================================
  console.log("\n🧪 Creating test users...");

  for (const user of TEST_USERS) {
    await prisma.eligibleUser.create({
      data: {
        email: user.email.toLowerCase(),
        name: user.name,
        company: "Test Company",
        role: "Tester",
        approvalStatus: "approved",
        hasClaimed: false,
      },
    });
  }

  console.log(`   ✅ ${TEST_USERS.length} test users created`);

  // ============================================
  // FINAL STATISTICS
  // ============================================
  const stats = {
    totalCredits: await prisma.credit.count(),
    availableCredits: await prisma.credit.count({ where: { isUsed: false, isTest: false } }),
    testCredits: await prisma.credit.count({ where: { isTest: true } }),
    usedCredits: await prisma.credit.count({ where: { isUsed: true } }),
    totalEligibleUsers: await prisma.eligibleUser.count(),
    testUsers: await prisma.eligibleUser.count({ where: { company: "Test Company" } }),
  };

  console.log("\n" + "=".repeat(50));
  console.log("📊 FINAL STATISTICS");
  console.log("=".repeat(50));
  console.log(`   Total credits:        ${stats.totalCredits}`);
  console.log(`   Available credits:    ${stats.availableCredits}`);
  console.log(`   Test credits:         ${stats.testCredits}`);
  console.log(`   Used credits:         ${stats.usedCredits}`);
  console.log(`   Eligible users:       ${stats.totalEligibleUsers}`);
  console.log(`   Test users:           ${stats.testUsers}`);
  console.log("=".repeat(50));
  console.log("\n🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
