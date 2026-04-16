import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import {
  parseCreditsCsv,
  parseUsersCsv,
  extractCode,
  normalizeCreditLink,
} from "@/lib/csv-import";
import {
  isDatabaseConnectionError,
  jsonDatabaseUnavailable,
} from "@/lib/db-errors";

const MAX_CSV_CHARS = 5_000_000;
const MAX_ERRORS = 20;

type ImportKind = "credits" | "users";

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("kind" in body) ||
      !("csv" in body)
    ) {
      return NextResponse.json(
        { error: "Expected { kind, csv, options? }" },
        { status: 400 }
      );
    }

    const kind = (body as { kind: string }).kind as ImportKind;
    const csv = (body as { csv: unknown }).csv;
    const options = (body as { options?: { isTest?: boolean } }).options;

    if (kind !== "credits" && kind !== "users") {
      return NextResponse.json(
        { error: "kind must be 'credits' or 'users'" },
        { status: 400 }
      );
    }

    if (typeof csv !== "string") {
      return NextResponse.json({ error: "csv must be a string" }, { status: 400 });
    }

    if (csv.length > MAX_CSV_CHARS) {
      return NextResponse.json(
        { error: `CSV too large (max ${MAX_CSV_CHARS} characters)` },
        { status: 400 }
      );
    }

    if (kind === "credits") {
      const result = await importCredits(csv, options?.isTest === true);
      return NextResponse.json({ success: true, ...result });
    }

    const result = await importUsers(csv);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("❌ [ADMIN] import-csv:", error);
    if (isDatabaseConnectionError(error)) {
      return jsonDatabaseUnavailable({ success: false });
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function importCredits(csv: string, isTest: boolean) {
  const errors: string[] = [];
  const pushErr = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };

  const parsed = parseCreditsCsv(csv);
  let invalid = 0;
  let duplicateInFile = 0;
  const seenCodes = new Set<string>();
  const batch: {
    code: string;
    link: string;
    isUsed: boolean;
    isTest: boolean;
    assignedAt: Date | null;
  }[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const link = (row.link || "").trim();
    if (!link) {
      invalid++;
      pushErr(`Row ${i + 1}: empty link`);
      continue;
    }
    const code = extractCode(link);
    if (seenCodes.has(code)) {
      duplicateInFile++;
      continue;
    }
    seenCodes.add(code);
    const isUsed = (row.status || "").toLowerCase() === "taken";
    batch.push({
      code,
      link: normalizeCreditLink(link, code),
      isUsed,
      isTest,
      assignedAt: isUsed ? new Date() : null,
    });
  }

  const createResult = await prisma.credit.createMany({
    data: batch,
    skipDuplicates: true,
  });

  const created = createResult.count;
  const skippedDbDuplicates = batch.length - created;
  const skipped =
    invalid + duplicateInFile + skippedDbDuplicates;

  return {
    kind: "credits" as const,
    created,
    skipped,
    invalid,
    duplicateInFile,
    skippedDbDuplicates,
    rowCount: parsed.length,
    errors: errors.length ? errors : undefined,
  };
}

async function importUsers(csv: string) {
  const errors: string[] = [];
  const pushErr = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };

  const rows = parseUsersCsv(csv);
  let invalid = 0;
  let duplicateInFile = 0;
  const seenEmails = new Set<string>();
  const candidates: {
    email: string;
    name: string;
    company: string | null;
    role: string | null;
    approvalStatus: string;
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = (row.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      invalid++;
      pushErr(`Row ${i + 2}: invalid or missing email`);
      continue;
    }
    if (seenEmails.has(email)) {
      duplicateInFile++;
      continue;
    }
    seenEmails.add(email);

    const approvalRaw = (row.approval_status || row.status || "approved").trim();
    const approvalStatus = approvalRaw ? approvalRaw.toLowerCase() : "approved";

    candidates.push({
      email,
      name: (row.name || "Unknown").trim() || "Unknown",
      company: row.company?.trim() || null,
      role: row.role?.trim() || null,
      approvalStatus,
    });
  }

  const existing = await prisma.eligibleUser.findMany({
    select: { email: true },
  });
  const existingSet = new Set(existing.map((e) => e.email.toLowerCase()));

  const toInsert = candidates.filter((c) => !existingSet.has(c.email));
  const alreadyInDatabase = candidates.length - toInsert.length;

  const createResult = await prisma.eligibleUser.createMany({
    data: toInsert,
    skipDuplicates: true,
  });

  const created = createResult.count;
  const skippedDbDuplicates = toInsert.length - created;
  const skipped =
    invalid + duplicateInFile + alreadyInDatabase + skippedDbDuplicates;

  return {
    kind: "users" as const,
    created,
    skipped,
    invalid,
    duplicateInFile,
    alreadyInDatabase,
    skippedDbDuplicates,
    rowCount: rows.length,
    errors: errors.length ? errors : undefined,
  };
}
