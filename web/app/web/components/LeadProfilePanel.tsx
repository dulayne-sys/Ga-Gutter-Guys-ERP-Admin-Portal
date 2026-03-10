"use client";

import { useEffect, useState } from "react";
import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { normalizeLeadSource, LEAD_SOURCE_LABELS } from "./modals/AddLeadModal";

type TableRow = Record<string, unknown>;

type Note = {
  text: string;
  author: string;
  createdAt: string; // ISO string stored in Firestore array
};

type LeadProfilePanelProps = {
  lead: TableRow;
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
};

const ALL_STATUSES = [
  "new",
  "contacted",
  "scheduled",
  "estimating",
  "won",
  "lost",
  "completed",
  "on hold",
] as const;

const STATUS_COLORS: Record<string, string> = {
  new: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  contacted: "border-indigo-400/40 bg-indigo-500/10 text-indigo-200",
  scheduled: "border-violet-400/40 bg-violet-500/10 text-violet-200",
  estimating: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  won: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  lost: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  completed: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  "on hold": "border-slate-400/40 bg-slate-500/10 text-slate-200",
};

const formatDate = (raw: unknown): string => {
  if (!raw) return "—";
  const source =
    typeof raw === "object" && raw && "toDate" in raw
      ? (raw as { toDate: () => Date }).toDate()
      : new Date(String(raw));
  return Number.isNaN(source.getTime())
    ? "—"
    : source.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
};

export function LeadProfilePanel({ lead, onClose, onStatusChange }: LeadProfilePanelProps) {
  const [currentStatus, setCurrentStatus] = useState(String(lead.status ?? "new"));
  const [statusSaving, setStatusSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("System User");

  const leadId = String(lead.id ?? "");

  // Resolve current user name for notes
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const name =
        user.displayName?.trim() ||
        user.email?.split("@")[0] ||
        "System User";
      setCurrentUserName(name);
    });
    return () => unsub();
  }, []);

  // Load notes from Firestore
  useEffect(() => {
    if (!leadId || !firestore) return;
    let cancelled = false;

    getDoc(doc(firestore, "leads", leadId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data();
        const raw = data?.notes;
        if (Array.isArray(raw)) {
          setNotes(raw as Note[]);
        }
      })
      .catch(() => {
        // silent — notes section will show empty
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const handleStatusSave = async () => {
    if (!leadId) return;
    setStatusSaving(true);
    try {
      await onStatusChange(leadId, currentStatus);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !leadId || !firestore) return;
    setNoteSaving(true);
    setNoteError(null);

    const newNote: Note = {
      text: noteText.trim(),
      author: currentUserName,
      createdAt: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(firestore, "leads", leadId), {
        notes: arrayUnion(newNote),
      });
      setNotes((prev) => [...prev, newNote]);
      setNoteText("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setNoteSaving(false);
    }
  };

  const address = lead.address as { street?: string; city?: string; state?: string; zip?: string } | undefined;
  const fullName = `${String(lead.firstName ?? "")} ${String(lead.lastName ?? "")}`.trim() || "—";
  const rawSource = String(lead.leadSource ?? "other");
  const displaySource = LEAD_SOURCE_LABELS[normalizeLeadSource(rawSource)] ?? rawSource;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">{fullName}</h2>
            <p className="mt-0.5 text-xs text-slate-400">Lead Profile</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-lg border border-white/10 p-2 text-slate-400 hover:border-white/30 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">

          {/* Customer Info */}
          <section>
            <p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">Customer Info</p>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <Row label="Name" value={fullName} />
              <Row label="Phone" value={String(lead.phone ?? "—")} />
              <Row label="Email" value={String(lead.email ?? "—")} />
              <Row
                label="Address"
                value={
                  address?.street
                    ? `${address.street}, ${address.city ?? ""} ${address.state ?? ""} ${address.zip ?? ""}`.trim()
                    : "—"
                }
              />
            </div>
          </section>

          {/* Lead Cycle */}
          <section>
            <p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">Lead Cycle</p>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <Row label="Source" value={displaySource} />
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-slate-400">Status</span>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[currentStatus] ?? "border-white/10 bg-white/5 text-slate-200"}`}>
                  {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                </span>
              </div>
              <Row label="Rep" value={String(lead.assignedTo ?? "Unassigned")} />
              <Row label="Created" value={formatDate(lead.createdAt)} />
            </div>
          </section>

          {/* Status Update */}
          <section>
            <p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">Update Status</p>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleStatusSave()}
                disabled={statusSaving}
                className="mt-3 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {statusSaving ? "Saving..." : "Save Status"}
              </button>
            </div>
          </section>

          {/* Notes */}
          <section>
            <p className="mb-3 text-[11px] uppercase tracking-[0.15em] text-slate-500">Notes</p>

            {/* Existing notes */}
            <div className="mb-3 space-y-2">
              {notes.length === 0 ? (
                <p className="text-xs text-slate-500">No notes yet.</p>
              ) : (
                notes
                  .slice()
                  .reverse()
                  .map((note, idx) => {
                    const d = new Date(note.createdAt);
                    const dateStr = Number.isNaN(d.getTime())
                      ? ""
                      : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      >
                        <p className="mb-1 text-[11px] text-slate-500">
                          {dateStr} — {note.author}
                        </p>
                        <p className="text-slate-200">{note.text}</p>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Add note */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              {noteError ? (
                <p className="mt-1 text-xs text-rose-400">{noteError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleAddNote()}
                disabled={noteSaving || !noteText.trim()}
                className="mt-2 w-full rounded-lg bg-white/10 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {noteSaving ? "Saving..." : "Add Note"}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}
