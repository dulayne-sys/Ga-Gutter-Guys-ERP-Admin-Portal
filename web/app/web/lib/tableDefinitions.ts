export type ColumnType = "text" | "currency" | "date" | "status" | "timestamp";

export interface ColumnDefinition {
  field: string;
  label: string;
  type: ColumnType;
  render?: (value: unknown, row: Record<string, unknown>) => string | number;
}

export type TableViewKey =
  | "leads"
  | "customers"
  | "estimates"
  | "jobs"
  | "invoices"
  | "materials"
  | "vendors"
  | "users"
  | "crm"
  | "active-jobs"
  | "work-orders"
  | "calendar"
  | "job-erp"
  | "procurements";

export type TableColumn = ColumnDefinition;

export const VIEW_TO_COLLECTION: Record<TableViewKey, string> = {
  leads: "leads",
  customers: "customers",
  estimates: "estimates",
  jobs: "jobs",
  invoices: "invoices",
  materials: "materials",
  vendors: "vendors",
  users: "users",
  crm: "leads",
  "active-jobs": "jobs",
  "work-orders": "jobs",
  calendar: "jobs",
  "job-erp": "jobs",
  procurements: "vendors",
};

export const TABLE_DEFINITIONS: Record<TableViewKey, ColumnDefinition[]> = {
  leads: [
    {
      field: "firstName",
      label: "Name",
      type: "text",
      render: (_value, row) => `${String(row.firstName ?? "")} ${String(row.lastName ?? "")}`.trim() || "—",
    },
    { field: "email", label: "Email", type: "text" },
    { field: "phone", label: "Phone", type: "text" },
    {
      field: "address",
      label: "Address",
      type: "text",
      render: (value) => String((value as { street?: string } | undefined)?.street ?? "—"),
    },
    { field: "status", label: "Status", type: "status" },
    { field: "leadSource", label: "Source", type: "text" },
    { field: "createdAt", label: "Created", type: "timestamp" },
  ],
  customers: [
    { field: "name", label: "Customer", type: "text" },
    {
      field: "primaryContact",
      label: "Email",
      type: "text",
      render: (value) => String((value as { email?: string } | undefined)?.email ?? "—"),
    },
    {
      field: "primaryContact",
      label: "Phone",
      type: "text",
      render: (value) => String((value as { phone?: string } | undefined)?.phone ?? "—"),
    },
    {
      field: "serviceAddress",
      label: "Address",
      type: "text",
      render: (value) => String((value as { street?: string } | undefined)?.street ?? "—"),
    },
    {
      field: "quickBooksCustomerId",
      label: "QB Sync",
      type: "text",
      render: (value) => (value ? "Synced" : "Pending"),
    },
    { field: "createdAt", label: "Created", type: "timestamp" },
  ],
  estimates: [
    { field: "id", label: "Estimate #", type: "text" },
    {
      field: "address",
      label: "Address",
      type: "text",
      render: (value) => String((value as { street?: string } | undefined)?.street ?? "—"),
    },
    {
      field: "measurements",
      label: "Linear Feet",
      type: "text",
      render: (value) => {
        const linearFeet = (value as { linearFeet?: number } | undefined)?.linearFeet;
        return typeof linearFeet === "number" ? `${linearFeet} LF` : "—";
      },
    },
    {
      field: "pricing",
      label: "Total",
      type: "currency",
      render: (value) => Number((value as { grandTotal?: number } | undefined)?.grandTotal ?? 0),
    },
    { field: "status", label: "Status", type: "status" },
    { field: "createdAt", label: "Created", type: "timestamp" },
  ],
  jobs: [
    { field: "id", label: "Job #", type: "text" },
    { field: "customerId", label: "Customer", type: "text" },
    { field: "status", label: "Status", type: "status" },
    {
      field: "schedule",
      label: "Install Date",
      type: "timestamp",
      render: (value) => (value as { installDate?: unknown } | undefined)?.installDate as string || "—",
    },
    {
      field: "schedule",
      label: "Crew",
      type: "text",
      render: (value) => {
        const crew = (value as { crew?: string[] } | undefined)?.crew;
        return Array.isArray(crew) && crew.length ? crew.join(", ") : "—";
      },
    },
    { field: "createdAt", label: "Created", type: "timestamp" },
  ],
  invoices: [
    { field: "id", label: "Invoice #", type: "text" },
    { field: "customerId", label: "Customer", type: "text" },
    { field: "amountDue", label: "Amount", type: "currency" },
    { field: "status", label: "Status", type: "status" },
    { field: "dueDate", label: "Due Date", type: "timestamp" },
    {
      field: "qbSyncStatus",
      label: "QB Sync",
      type: "status",
      render: (value) => (value === "synced" ? "Synced" : "Pending"),
    },
    { field: "createdAt", label: "Created", type: "timestamp" },
  ],
  materials: [
    { field: "sku", label: "SKU", type: "text" },
    { field: "name", label: "Name", type: "text" },
    { field: "category", label: "Category", type: "text" },
    { field: "unit", label: "Unit", type: "text" },
    { field: "cost", label: "Cost", type: "currency" },
    { field: "price", label: "Price", type: "currency" },
    {
      field: "active",
      label: "Status",
      type: "status",
      render: (value) => (value ? "Active" : "Inactive"),
    },
  ],
  vendors: [
    { field: "name", label: "Vendor", type: "text" },
    { field: "category", label: "Category", type: "text" },
    { field: "contactPerson", label: "Contact", type: "text" },
    { field: "phone", label: "Phone", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "status", label: "Status", type: "status" },
    { field: "insuranceExpiry", label: "Insurance Expiry", type: "timestamp" },
  ],
  users: [
    { field: "displayName", label: "Name", type: "text" },
    { field: "email", label: "Email", type: "text" },
    { field: "phone", label: "Phone", type: "text" },
    { field: "role", label: "Role", type: "status" },
    {
      field: "active",
      label: "Status",
      type: "status",
      render: (value) => (value ? "Active" : "Inactive"),
    },
    { field: "createdAt", label: "Created", type: "timestamp" },
  ],
  crm: [],
  "active-jobs": [],
  "work-orders": [],
  calendar: [],
  "job-erp": [],
  procurements: [],
};

TABLE_DEFINITIONS.crm = TABLE_DEFINITIONS.leads;
TABLE_DEFINITIONS["active-jobs"] = TABLE_DEFINITIONS.jobs;
TABLE_DEFINITIONS["work-orders"] = TABLE_DEFINITIONS.jobs;
TABLE_DEFINITIONS.calendar = TABLE_DEFINITIONS.jobs;
TABLE_DEFINITIONS["job-erp"] = TABLE_DEFINITIONS.jobs;
TABLE_DEFINITIONS.procurements = TABLE_DEFINITIONS.vendors;
