/**
 * Migration Script: Google Sheets → Firestore
 * Run this ONCE to migrate existing data
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.SPREADSHEET_ID;

if (!spreadsheetId) {
  throw new Error("SPREADSHEET_ID is required.");
}

let cachedSheetTitles: string[] | null = null;

const normalizeSheetName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

async function getSheetTitles(): Promise<string[]> {
  if (cachedSheetTitles) {
    return cachedSheetTitles;
  }

  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  cachedSheetTitles = (metadata.data.sheets ?? [])
    .map((sheet) => String(sheet.properties?.title ?? "").trim())
    .filter(Boolean);

  return cachedSheetTitles;
}

async function resolveSheetName(preferredName: string, aliases: string[] = []): Promise<string> {
  const titles = await getSheetTitles();
  const candidates = [preferredName, ...aliases].filter(Boolean);

  for (const candidate of candidates) {
    const exact = titles.find((title) => title === candidate);
    if (exact) {
      return exact;
    }
  }

  const normalizedCandidates = new Set(candidates.map(normalizeSheetName));
  const normalizedMatch = titles.find((title) => normalizedCandidates.has(normalizeSheetName(title)));
  if (normalizedMatch) {
    return normalizedMatch;
  }

  throw new Error(
    `Unable to locate sheet tab for "${preferredName}". Available tabs: ${titles.join(", ")}`
  );
}

async function getSheetData(sheetName: string, aliases: string[] = []): Promise<Record<string, string>[]> {
  const resolvedSheet = await resolveSheetName(sheetName, aliases);
  console.log(`   ↳ Reading tab: ${resolvedSheet}`);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${resolvedSheet}!A:Z`,
  });

  const rows = response.data.values ?? [];
  if (!rows.length) return [];

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[String(header)] = String(row[index] ?? "");
    });
    return rowObj;
  });
}

const parseMaybeDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function mapLeadStatus(status: string): string {
  const map: Record<string, string> = {
    New: "new",
    Contacted: "contacted",
    "Inspection Scheduled": "scheduled",
    "Estimate Sent": "estimating",
    "Closed Won": "won",
    "Closed Lost": "lost",
  };
  return map[status] ?? "new";
}

function mapJobStatus(status: string): string {
  const map: Record<string, string> = {
    Scheduled: "scheduled",
    "In Progress": "in_progress",
    Complete: "completed",
    "On Hold": "on_hold",
  };
  return map[status] ?? "scheduled";
}

function mapInvoiceStatus(status: string): string {
  const map: Record<string, string> = {
    Draft: "draft",
    Sent: "sent",
    Paid: "paid",
    Unpaid: "sent",
    Overdue: "overdue",
  };
  return map[status] ?? "draft";
}

async function migrateCRMToLeads() {
  console.log("📋 Migrating CRM → leads...");

  const crmData = await getSheetData("CRM", ["crm"]);
  const batch = db.batch();

  for (const row of crmData) {
    const leadRef = db.collection("leads").doc();
    const splitName = String(row["Lead Name"] ?? "").trim().split(/\s+/).filter(Boolean);

    batch.set(leadRef, {
      firstName: row["First Name"] || splitName[0] || "",
      lastName: row["Last Name"] || splitName.slice(1).join(" ") || "",
      phone: row.Phone || "",
      email: row.Email || "",
      address: {
        street: row.Address || "",
        city: row.City || "",
        state: row.State || "",
        zip: row.Zip || "",
        lat: null,
        lng: null,
      },
      propertyType: row["Property Type"] || "residential",
      leadSource: (row["Lead Source"] || "other").toLowerCase(),
      status: mapLeadStatus(row["Lead Status"] || ""),
      assignedTo: null,
      notes: row.Notes ? [row.Notes] : [],
      nextFollowUpAt: null,
      createdAt: parseMaybeDate(row["Created Date"]) || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: null,
    });
  }

  await batch.commit();
  console.log(`✅ Migrated ${crmData.length} leads`);
}

async function migrateActiveJobsToJobs() {
  console.log("📋 Migrating Active Jobs → jobs...");

  const jobsData = await getSheetData("Active Jobs", ["ACTIVE_JOBS", "ActiveJobs", "active_jobs"]);

  for (const row of jobsData) {
    const customerRef = db.collection("customers").doc();
    const jobRef = db.collection("jobs").doc();
    const batch = db.batch();

    batch.set(customerRef, {
      name: row["Customer Name"] || "",
      primaryContact: {
        name: row["Customer Name"] || "",
        phone: row.Phone || "",
        email: row.Email || "",
      },
      serviceAddress: {
        street: row.Address || "",
        city: "",
        state: "",
        zip: "",
      },
      billingAddress: null,
      leadId: null,
      quickBooksCustomerId: null,
      tags: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(jobRef, {
      customerId: customerRef.id,
      estimateId: null,
      status: mapJobStatus(row.Status || ""),
      schedule: {
        installDate: parseMaybeDate(row["Start Date"]),
        arrivalWindow: "",
        crew: row["Crew Assigned"] ? [row["Crew Assigned"]] : [],
      },
      jobNotes: row.Notes || "",
      photos: [],
      completion: {
        completedAt: parseMaybeDate(row["Completion Date"]),
        completedBy: null,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
  }

  console.log(`✅ Migrated ${jobsData.length} jobs`);
}

async function migrateInvoices() {
  console.log("📋 Migrating Invoices → invoices...");

  const invoicesData = await getSheetData("Invoices", ["INVOICES", "invoices"]);
  const batch = db.batch();

  for (const row of invoicesData) {
    const invoiceRef = db.collection("invoices").doc();

    batch.set(invoiceRef, {
      jobId: null,
      customerId: null,
      estimateId: null,
      status: mapInvoiceStatus(row.Status || ""),
      amountDue: Number.parseFloat(row.Amount || "0") || 0,
      dueDate: parseMaybeDate(row["Due Date"]),
      quickBooksInvoiceId: row["QB Invoice ID"] || null,
      qbSyncStatus: row["QB Invoice ID"] ? "synced" : "pending",
      payment: row.Status === "Paid" ? {
        paidAt: parseMaybeDate(row["Date Paid"]),
        method: "unknown",
        txnId: null,
      } : null,
      createdAt: parseMaybeDate(row["Date Issued"]) || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`✅ Migrated ${invoicesData.length} invoices`);
}

async function migrateVendors() {
  console.log("📋 Migrating Vendors → vendors...");

  const vendorsData = await getSheetData("Vendors", ["VENDORS", "vendors"]);
  const batch = db.batch();

  for (const row of vendorsData) {
    const vendorRef = db.collection("vendors").doc();

    batch.set(vendorRef, {
      name: row["Vendor Name"] || "",
      category: row.Category || "",
      contactPerson: row["Contact Person"] || "",
      phone: row.Phone || "",
      email: row.Email || "",
      address: row.Address || "",
      status: row.Status || "Active",
      insuranceExpiry: parseMaybeDate(row["Insurance Expiry"]),
      notes: row.Notes || "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log(`✅ Migrated ${vendorsData.length} vendors`);
}

async function runMigration() {
  console.log("🚀 Starting migration from Google Sheets to Firestore...\n");

  try {
    await migrateCRMToLeads();
    await migrateActiveJobsToJobs();
    await migrateInvoices();
    await migrateVendors();

    console.log("\n🎉 Migration complete! Data is now in Firestore.");
    console.log("⚠️  Please verify data in Firebase Console before proceeding.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
