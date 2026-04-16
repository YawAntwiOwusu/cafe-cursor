/**
 * Shared CSV parsing for credits and eligible users (seed + admin import).
 */

export type CreditCsvRow = { link: string; status?: string };

/** Extract referral code from a Cursor referral URL or raw token. */
export function extractCode(link: string): string {
  const match = link.match(/code=([A-Za-z0-9]+)/);
  return match ? match[1] : link.replace(/[^A-Za-z0-9]/g, "").substring(0, 12);
}

export function normalizeCreditLink(link: string, code: string): string {
  const t = link.trim();
  return t.startsWith("http") ? t : `https://cursor.com/referral?code=${code}`;
}

/**
 * Credits: one referral URL per line, or CSV with link/url (+ optional status).
 */
export function parseCreditsCsv(content: string): CreditCsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const first = lines[0].replace(/^\ufeff/, "");
  if (first.startsWith("http://") || first.startsWith("https://")) {
    return lines
      .map((l) => l.replace(/^\ufeff/, ""))
      .filter((l) => l.startsWith("http://") || l.startsWith("https://"))
      .map((link) => ({ link }));
  }

  const headers = first
    .replace(/^\ufeff/, "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const rows: CreditCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    const link = row.link || row.url || "";
    if (link) rows.push({ link, status: row.status });
  }
  return rows;
}

/**
 * Users: header row (email, name, company, approval_status, role, …) plus data rows.
 */
export function parseUsersCsv(content: string): Record<string, string>[] {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0]
    .replace(/^\ufeff/, "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  return rows;
}
