"use client";

import { useMemo, useState } from "react";
import type { TableColumn } from "../lib/tableDefinitions";

type DataTableProps = {
  title: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  loading?: boolean;
  searchable?: boolean;
  onRowClick?: (row: Record<string, unknown>) => void;
  highlightRowId?: string;
};

const formatValue = (value: unknown, type?: TableColumn["type"]): string | number => {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "currency") {
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? `$${parsed.toLocaleString()}` : String(value);
  }
  if (type === "date" || type === "timestamp") {
    const source = typeof value === "object" && value && "toDate" in value
      ? (value as { toDate: () => Date }).toDate()
      : value;
    const date = new Date(String(source));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  return String(value);
};

const getStatusClass = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  if (["paid", "complete", "active", "closed won"].includes(normalized)) {
    return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
  }
  if (["overdue", "closed lost", "inactive"].includes(normalized)) {
    return "border-rose-400/40 bg-rose-500/10 text-rose-200";
  }
  return "border-amber-400/40 bg-amber-500/10 text-amber-200";
};

export function DataTable({ title, columns, rows, loading, searchable = true, onRowClick, highlightRowId }: DataTableProps) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const needle = query.toLowerCase();
    return rows.filter((row) => Object.values(row).map((value) => String(value ?? "")).join(" ").toLowerCase().includes(needle));
  }, [query, rows]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
        {searchable ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}

      {!loading && filteredRows.length === 0 ? <p className="text-sm text-slate-500">No records found.</p> : null}

      {!loading && filteredRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {columns.map((column) => (
                  <th key={column.field} className="px-3 py-2 font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                (() => {
                  const rowId = String(row.id ?? "");
                  const isHighlighted = Boolean(highlightRowId) && rowId === highlightRowId;
                  return (
                <tr
                  key={`row-${index}`}
                  className={`border-b text-slate-200 hover:bg-white/[0.03] ${
                    isHighlighted
                      ? "border-cyan-300/40 bg-cyan-500/10"
                      : "border-white/5"
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => {
                    const raw = row[column.field];
                    const rendered = column.render ? column.render(raw, row) : raw;
                    const formatted = formatValue(rendered, column.type);
                    return (
                      <td key={`${index}-${column.field}`} className="px-3 py-2 align-top">
                        {column.type === "status" ? (
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${getStatusClass(String(rendered ?? ""))}`}>
                            {formatted}
                          </span>
                        ) : (
                          formatted
                        )}
                      </td>
                    );
                  })}
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
