import { google } from "googleapis";
import { getGoogleAuth } from "./google";
import type { ScoredInquiry } from "./types";

const SHEET_NAME = "Leads";
// Keep this in sync with the header row created by AUTOMATION.md's setup steps.
const COLUMNS = [
  "Timestamp",
  "Reference",
  "Source",
  "Score",
  "Tags",
  "Name",
  "Organization",
  "Email",
  "Phone",
  "Preferred Contact",
  "Project Type",
  "Product Description",
  "Quantity",
  "Budget Range",
  "Decoration Method",
  "Placements",
  "Design Help",
  "Needed By",
  "Event Date",
  "Delivery Method",
  "Postal Code",
  "Message",
  "File Links",
  "Status",
] as const;

function getSheets() {
  const auth = getGoogleAuth();
  if (!auth) return null;
  return google.sheets({ version: "v4", auth });
}

function rowFor(inquiry: ScoredInquiry, fileLinks: string[]): string[] {
  const values: Record<(typeof COLUMNS)[number], string> = {
    Timestamp: new Date().toISOString(),
    Reference: inquiry.reference,
    Source: inquiry.source,
    Score: String(inquiry.score),
    Tags: inquiry.tags.join(", "),
    Name: inquiry.name,
    Organization: inquiry.organization ?? "",
    Email: inquiry.email,
    Phone: inquiry.phone ?? "",
    "Preferred Contact": inquiry.preferredContact ?? "",
    "Project Type": inquiry.projectType ?? "",
    "Product Description": inquiry.productDescription ?? "",
    Quantity: inquiry.quantity ?? "",
    "Budget Range": inquiry.budgetRange ?? "",
    "Decoration Method": inquiry.decorationMethod ?? "",
    Placements: inquiry.placements ?? "",
    "Design Help": inquiry.designHelp ? "Yes" : "",
    "Needed By": inquiry.neededBy ?? "",
    "Event Date": inquiry.eventDate ?? "",
    "Delivery Method": inquiry.deliveryMethod ?? "",
    "Postal Code": inquiry.postalCode ?? "",
    Message: inquiry.message ?? "",
    "File Links": fileLinks.join(", "),
    Status: "New",
  };
  return COLUMNS.map((c) => values[c]);
}

/**
 * Appends one row per inquiry to the "Leads" sheet. No-ops (logs a warning)
 * when Google credentials aren't configured, so submissions keep working
 * before the spreadsheet is wired up.
 */
export async function appendInquiryRow(inquiry: ScoredInquiry, fileLinks: string[] = []): Promise<void> {
  const sheets = getSheets();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheets || !sheetId) {
    console.warn("[automation] Google Sheets not configured; skipping lead log for", inquiry.reference);
    return;
  }

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A:A`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowFor(inquiry, fileLinks)] },
    });
  } catch (err) {
    console.error("[automation] Failed to append lead row:", err);
  }
}

/**
 * Counts existing references starting with today's `MI-YYYYMMDD-` prefix,
 * used to derive the next sequence number. Returns null when Sheets isn't
 * configured, so the caller can fall back to a random suffix.
 */
export async function countReferencesWithPrefix(prefix: string): Promise<number | null> {
  const sheets = getSheets();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheets || !sheetId) return null;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!B:B`,
    });
    const rows = res.data.values ?? [];
    return rows.filter((r) => typeof r[0] === "string" && r[0].startsWith(prefix)).length;
  } catch (err) {
    console.error("[automation] Failed to read reference column:", err);
    return null;
  }
}
