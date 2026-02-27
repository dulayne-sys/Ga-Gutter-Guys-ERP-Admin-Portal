"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import {
  TABLE_DEFINITIONS,
  VIEW_TO_COLLECTION,
  type TableColumn,
  type TableViewKey,
} from "./tableDefinitions";

export interface FirestoreDocument {
  id: string;
  [key: string]: unknown;
}

export type TableRow = Record<string, unknown>;

class FirestoreDataLoader {
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000;

  private ensureDb() {
    if (!firestore) {
      throw new Error("Firestore client unavailable.");
    }
    return firestore;
  }

  async loadCollection(
    collectionName: string,
    filters?: Array<{ field: string; operator: "==" | "<" | "<=" | ">" | ">=" | "!=" | "in" | "array-contains"; value: unknown }>,
    orderByField?: string,
    limitCount?: number
  ): Promise<FirestoreDocument[]> {
    const cacheKey = `${collectionName}_${JSON.stringify(filters || [])}_${orderByField || ""}_${limitCount || ""}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data as FirestoreDocument[];
      }
    }

    const db = this.ensureDb();
    const constraints: QueryConstraint[] = [];

    for (const filter of filters ?? []) {
      constraints.push(where(filter.field, filter.operator, filter.value));
    }

    if (orderByField) {
      constraints.push(orderBy(orderByField, "desc"));
    }

    if (limitCount) {
      constraints.push(limit(limitCount));
    }

    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  async loadDocument(collectionName: string, docId: string): Promise<FirestoreDocument | null> {
    const db = this.ensureDb();
    const snapshot = await getDoc(doc(db, collectionName, docId));

    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  async createDocument(collectionName: string, data: Record<string, unknown>): Promise<string> {
    const db = this.ensureDb();
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    this.clearCacheForCollection(collectionName);
    return docRef.id;
  }

  async updateDocument(collectionName: string, docId: string, data: Record<string, unknown>): Promise<void> {
    const db = this.ensureDb();
    await updateDoc(doc(db, collectionName, docId), {
      ...data,
      updatedAt: serverTimestamp(),
    });

    this.clearCacheForCollection(collectionName);
  }

  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    const db = this.ensureDb();
    await deleteDoc(doc(db, collectionName, docId));
    this.clearCacheForCollection(collectionName);
  }

  async getLeads(status?: string) {
    return this.loadCollection(
      "leads",
      status ? [{ field: "status", operator: "==", value: status }] : undefined,
      "createdAt"
    );
  }

  async getLead(leadId: string) {
    return this.loadDocument("leads", leadId);
  }

  async createLead(leadData: Record<string, unknown>) {
    return this.createDocument("leads", leadData);
  }

  async updateLead(leadId: string, leadData: Record<string, unknown>) {
    return this.updateDocument("leads", leadId, leadData);
  }

  async getCustomers() {
    return this.loadCollection("customers", undefined, "createdAt");
  }

  async getEstimates(status?: string) {
    return this.loadCollection(
      "estimates",
      status ? [{ field: "status", operator: "==", value: status }] : undefined,
      "createdAt"
    );
  }

  async getJobs(status?: string) {
    return this.loadCollection(
      "jobs",
      status ? [{ field: "status", operator: "==", value: status }] : undefined,
      "createdAt"
    );
  }

  async getInvoices(status?: string) {
    return this.loadCollection(
      "invoices",
      status ? [{ field: "status", operator: "==", value: status }] : undefined,
      "createdAt"
    );
  }

  async getMaterials(activeOnly = true) {
    return this.loadCollection(
      "materials",
      activeOnly ? [{ field: "active", operator: "==", value: true }] : undefined,
      "updatedAt"
    );
  }

  async getVendors(activeOnly = true) {
    return this.loadCollection(
      "vendors",
      activeOnly ? [{ field: "status", operator: "==", value: "Active" }] : undefined,
      "updatedAt"
    );
  }

  async getUsers(role?: string) {
    return this.loadCollection(
      "users",
      role ? [{ field: "role", operator: "==", value: role }] : undefined,
      "updatedAt"
    );
  }

  clearCacheForCollection(collectionName: string) {
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(`${collectionName}_`)) {
        this.cache.delete(key);
      }
    }
  }

  clearAllCache() {
    this.cache.clear();
  }

  timestampToDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === "object" && value && "toDate" in value) {
      const maybeToDate = (value as { toDate?: () => Date }).toDate;
      if (typeof maybeToDate === "function") {
        return maybeToDate();
      }
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}

export const dataLoader = new FirestoreDataLoader();

export const loadDashboardKpis = async () => {
  const [leads, jobs, invoices, estimates] = await Promise.all([
    dataLoader.getLeads(),
    dataLoader.getJobs(),
    dataLoader.getInvoices(),
    dataLoader.getEstimates(),
  ]);

  const activeJobs = jobs.filter((job) => ["scheduled", "in_progress"].includes(String(job.status || ""))).length;
  const openPipeline = estimates
    .filter((estimate) => ["sent", "approved"].includes(String(estimate.status || "")))
    .reduce((sum, estimate) => {
      const pricing = estimate.pricing as { grandTotal?: number } | undefined;
      return sum + Number(pricing?.grandTotal ?? 0);
    }, 0);
  const revenueYtd = invoices
    .filter((invoice) => String(invoice.status || "") === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.amountDue ?? 0), 0);

  const won = leads.filter((lead) => String(lead.status || "") === "won").length;
  const lost = leads.filter((lead) => String(lead.status || "") === "lost").length;
  const winRate = won + lost > 0 ? won / (won + lost) : 0;

  return {
    activeJobs,
    openPipeline,
    revenueYtd,
    winRate,
  };
};

export const loadDashboardSnapshots = async () => {
  const [workOrders, activeJobs, invoices] = await Promise.all([
    dataLoader.getJobs(),
    dataLoader.getJobs(),
    dataLoader.getInvoices(),
  ]);

  return {
    workOrders: workOrders.slice(0, 5),
    activeJobs: activeJobs.slice(0, 5),
    invoices: invoices.slice(0, 5),
  };
};

export const loadTableData = async (view: TableViewKey) => {
  const collectionName = VIEW_TO_COLLECTION[view];
  const rows = await dataLoader.loadCollection(collectionName, undefined, "updatedAt");

  return {
    columns: TABLE_DEFINITIONS[view] as TableColumn[],
    rows,
  };
};
