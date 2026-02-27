"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { DatesSetArg, EventChangeArg, EventClickArg, EventInput } from "@fullcalendar/core";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { scrubCalendarAndOptimize } from "@/services/aiRoutePlanner";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  listGoogleCalendars,
  setGoogleCalendar,
  syncGoogleToFirestore,
  syncEventToGoogle,
  type GoogleCalendarListItem,
} from "@/services/googleCalendarService";
import type { ApiError } from "@/lib/api";

type CalendarEventStatus = "scheduled" | "estimate" | "install" | "meeting";
type CalendarView = "timeGridWeek" | "timeGridDay";

type FirestoreCalendarEvent = {
  id: string;
  jobId: string | null;
  title: string;
  start: Date;
  end: Date;
  crewAssigned: string;
  status: CalendarEventStatus;
  googleEventId: string | null;
  source: "crm" | "google";
  createdBy: string;
};

type EventEditorState = {
  id: string;
  title: string;
  status: CalendarEventStatus;
  crewAssigned: string;
  jobId: string;
  start: string;
  end: string;
  source: "crm" | "google";
};

const statusColorClass: Record<CalendarEventStatus, string> = {
  scheduled: "bg-blue-400/80 text-slate-950 border-0",
  install: "bg-emerald-400/80 text-slate-950 border-0",
  estimate: "bg-yellow-300/90 text-slate-950 border-0",
  meeting: "bg-purple-400/80 text-slate-950 border-0",
};

const toTimestampDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatYmd = (value: Date) => value.toISOString().slice(0, 10);

const pad = (value: number) => String(value).padStart(2, "0");

const toDateTimeLocal = (value: Date) => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const parseDateTimeLocal = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function OperationsCalendar() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<FirestoreCalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(firestore));
  const [selectedDate, setSelectedDate] = useState(formatYmd(new Date()));
  const [view, setView] = useState<CalendarView>("timeGridWeek");
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EventEditorState | null>(null);
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalCalendarId, setGcalCalendarId] = useState<string | null>(null);
  const [gcalCalendars, setGcalCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalMessage, setGcalMessage] = useState<string | null>(null);
  const [gcalSyncing, setGcalSyncing] = useState(false);

  const plugins = useMemo(() => [dayGridPlugin, timeGridPlugin, interactionPlugin], []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toEventInput = useCallback((event: FirestoreCalendarEvent): EventInput => {
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      className: statusColorClass[event.status],
      extendedProps: {
        status: event.status,
        crewAssigned: event.crewAssigned,
        jobId: event.jobId,
        source: event.source,
      },
    };
  }, []);

  const eventInputs = useMemo(() => events.map(toEventInput), [events, toEventInput]);

  useEffect(() => {
    if (!firestore) return;

    const eventsRef = collection(firestore, "calendarEvents");
    const eventsQuery = query(eventsRef, orderBy("start", "asc"));

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const rows: FirestoreCalendarEvent[] = snapshot.docs
          .map((item) => {
            const payload = item.data() as Record<string, unknown>;
            const start = toTimestampDate(payload.start);
            const end = toTimestampDate(payload.end);
            const status = String(payload.status ?? "scheduled") as CalendarEventStatus;

            if (!start || !end) return null;

            return {
              id: item.id,
              jobId: payload.jobId ? String(payload.jobId) : null,
              title: String(payload.title ?? "Untitled Event"),
              start,
              end,
              crewAssigned: String(payload.crewAssigned ?? ""),
              status: status in statusColorClass ? status : "scheduled",
              googleEventId: payload.googleEventId ? String(payload.googleEventId) : null,
              source: payload.source === "google" ? "google" : "crm",
              createdBy: String(payload.createdBy ?? ""),
            } satisfies FirestoreCalendarEvent;
          })
          .filter((item): item is FirestoreCalendarEvent => Boolean(item));

        setEvents(rows);
        setCalendarError(null);
        setLoading(false);
      },
      (error) => {
        setCalendarError(error.message || "Failed to load calendar events.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const resolvedError = !firestore
    ? "Firestore is not initialized."
    : calendarError;

  const loadGoogleCalendarState = useCallback(async () => {
    try {
      setGcalLoading(true);
      const status = await getGoogleCalendarStatus();
      setGcalConnected(status.connected);
      setGcalCalendarId(status.calendarId);

      if (!status.connected) {
        setGcalCalendars([]);
        return;
      }

      const listResult = await listGoogleCalendars();
      setGcalCalendars(listResult.calendars);
      setGcalCalendarId(listResult.selectedCalendarId);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError?.status === 412) {
        setGcalConnected(false);
        setGcalCalendars([]);
        setGcalCalendarId(null);
        return;
      }

      setGcalMessage(error instanceof Error ? error.message : "Unable to load Google Calendar status.");
    } finally {
      setGcalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGoogleCalendarState();
  }, [loadGoogleCalendarState]);

  const handleConnectGoogle = useCallback(async () => {
    try {
      setGcalMessage(null);
      setGcalLoading(true);
      await connectGoogleCalendar();
    } catch (error) {
      setGcalMessage(error instanceof Error ? error.message : "Unable to start Google Calendar connection.");
      setGcalLoading(false);
    }
  }, []);

  const handleDisconnectGoogle = useCallback(async () => {
    try {
      setGcalLoading(true);
      await disconnectGoogleCalendar();
      setGcalConnected(false);
      setGcalCalendarId(null);
      setGcalCalendars([]);
      setGcalMessage("Google Calendar disconnected.");
    } catch (error) {
      setGcalMessage(error instanceof Error ? error.message : "Unable to disconnect Google Calendar.");
    } finally {
      setGcalLoading(false);
    }
  }, []);

  const handleSwitchCalendar = useCallback(async (calendarId: string) => {
    if (!calendarId) return;

    try {
      setGcalLoading(true);
      setGcalMessage(null);
      await setGoogleCalendar(calendarId);
      setGcalCalendarId(calendarId);
      setGcalSyncing(true);
      const result = await syncGoogleToFirestore();
      setGcalMessage(`Google Calendar destination updated. Imported ${result.importedCount} event${result.importedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setGcalMessage(error instanceof Error ? error.message : "Unable to switch calendar.");
    } finally {
      setGcalSyncing(false);
      setGcalLoading(false);
    }
  }, []);

  const handleImportGoogleEvents = useCallback(async () => {
    try {
      setGcalSyncing(true);
      setGcalMessage(null);
      const result = await syncGoogleToFirestore();
      setGcalMessage(`Imported ${result.importedCount} Google event${result.importedCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setGcalMessage(error instanceof Error ? error.message : "Unable to import events from Google Calendar.");
    } finally {
      setGcalSyncing(false);
    }
  }, []);

  const handleDateSelection = useCallback((args: DatesSetArg) => {
    setSelectedDate(formatYmd(args.start));
  }, []);

  const handleCreateEvent = useCallback(async (arg: DateClickArg) => {
    if (!firestore) return;

    const startDate = arg.date;
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const uid = auth?.currentUser?.uid ?? "system";

    const payload = {
      jobId: null,
      title: "New Operations Event",
      start: Timestamp.fromDate(startDate),
      end: Timestamp.fromDate(endDate),
      crewAssigned: "",
      status: "scheduled" as CalendarEventStatus,
      googleEventId: null,
      source: "crm" as const,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const created = await addDoc(collection(firestore, "calendarEvents"), payload);
      await syncEventToGoogle({
        id: created.id,
        title: payload.title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        source: payload.source,
      });
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Unable to create calendar event.");
    }
  }, []);

  const handleEventMoveOrResize = useCallback(async (arg: EventChangeArg) => {
    if (!firestore) return;

    const start = arg.event.start;
    const end = arg.event.end;
    if (!start || !end) return;

    try {
      await updateDoc(doc(firestore, "calendarEvents", arg.event.id), {
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
        updatedAt: serverTimestamp(),
      });

      await syncEventToGoogle({
        id: arg.event.id,
        title: arg.event.title,
        start: start.toISOString(),
        end: end.toISOString(),
        source: "crm",
      });
    } catch (error) {
      arg.revert();
      setCalendarError(error instanceof Error ? error.message : "Unable to update calendar event.");
    }
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const start = arg.event.start;
    if (!start) return;
    const fallbackEnd = new Date(start.getTime() + 60 * 60 * 1000);
    const end = arg.event.end ?? fallbackEnd;

    const statusRaw = String(arg.event.extendedProps.status ?? "scheduled") as CalendarEventStatus;
    const status = statusRaw in statusColorClass ? statusRaw : "scheduled";

    const sourceRaw = arg.event.extendedProps.source;
    const source = sourceRaw === "google" ? "google" : "crm";

    setEditorState({
      id: arg.event.id,
      title: arg.event.title,
      status,
      crewAssigned: String(arg.event.extendedProps.crewAssigned ?? ""),
      jobId: String(arg.event.extendedProps.jobId ?? ""),
      start: toDateTimeLocal(start),
      end: toDateTimeLocal(end),
      source,
    });
  }, []);

  const handleEditorChange = useCallback((field: keyof EventEditorState, value: string) => {
    setEditorState((current) => {
      if (!current) return current;
      return { ...current, [field]: value } as EventEditorState;
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!firestore || !editorState) return;

    const startDate = parseDateTimeLocal(editorState.start);
    const endDate = parseDateTimeLocal(editorState.end);

    if (!startDate || !endDate || endDate <= startDate) {
      setCalendarError("Please provide a valid start/end time where end is after start.");
      return;
    }

    try {
      setEditing(true);

      await updateDoc(doc(firestore, "calendarEvents", editorState.id), {
        title: editorState.title.trim() || "Untitled Event",
        status: editorState.status,
        crewAssigned: editorState.crewAssigned.trim(),
        jobId: editorState.jobId.trim() || null,
        start: Timestamp.fromDate(startDate),
        end: Timestamp.fromDate(endDate),
        updatedAt: serverTimestamp(),
      });

      await syncEventToGoogle({
        id: editorState.id,
        title: editorState.title.trim() || "Untitled Event",
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        source: editorState.source,
      });

      setEditorState(null);
      setCalendarError(null);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Unable to save calendar event changes.");
    } finally {
      setEditing(false);
    }
  }, [editorState]);

  const handleDeleteEvent = useCallback(async () => {
    if (!firestore || !editorState) return;

    try {
      setEditing(true);
      await deleteDoc(doc(firestore, "calendarEvents", editorState.id));
      setEditorState(null);
      setCalendarError(null);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "Unable to delete calendar event.");
    } finally {
      setEditing(false);
    }
  }, [editorState]);

  const changeView = useCallback((nextView: CalendarView) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    setView(nextView);
    api.changeView(nextView);
  }, []);

  const runPlanner = useCallback(() => {
    void scrubCalendarAndOptimize(selectedDate);
  }, [selectedDate]);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Operations Calendar</h2>
          <p className="mt-1 text-sm text-slate-400">Drag, resize, and manage job schedule events in real time.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeView("timeGridWeek")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "timeGridWeek"
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => changeView("timeGridDay")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "timeGridDay"
                ? "bg-cyan-500/20 text-cyan-100"
                : "bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={runPlanner}
            className="rounded-lg bg-indigo-500/20 px-3 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/30"
          >
            Run AI Route Planner
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Google Calendar</span>
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${gcalConnected ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
            {gcalConnected ? "Connected" : "Not connected"}
          </span>

          {gcalConnected ? (
            <>
              <select
                value={gcalCalendarId ?? ""}
                onChange={(event) => void handleSwitchCalendar(event.target.value)}
                disabled={gcalLoading}
                className="min-w-[220px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                <option value="" disabled>Select calendar</option>
                {gcalCalendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.primary ? `${calendar.summary} (Primary)` : calendar.summary}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                disabled={gcalLoading}
                className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
              >
                Disconnect
              </button>

              <button
                type="button"
                onClick={() => void handleImportGoogleEvents()}
                disabled={gcalLoading || gcalSyncing}
                className="rounded-lg bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
              >
                {gcalSyncing ? "Importing..." : "Import from Google"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleConnectGoogle()}
              disabled={gcalLoading}
              className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              Connect Google Calendar
            </button>
          )}
        </div>

        {gcalMessage ? <p className="mt-2 text-xs text-slate-300">{gcalMessage}</p> : null}
      </div>

      {resolvedError ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{resolvedError}</div>
      ) : null}

      {loading || !mounted ? (
        <div className="min-h-[600px] animate-pulse rounded-xl border border-white/10 bg-slate-900/40" />
      ) : (
        <div className="operations-calendar min-h-[600px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-2">
          <FullCalendar
            ref={calendarRef}
            plugins={plugins}
            initialView={view}
            headerToolbar={false}
            events={eventInputs}
            editable
            selectable
            eventDurationEditable
            droppable={false}
            dateClick={handleCreateEvent}
            eventClick={handleEventClick}
            eventDrop={handleEventMoveOrResize}
            eventResize={handleEventMoveOrResize}
            datesSet={handleDateSelection}
            height="auto"
            nowIndicator
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            dayMaxEvents
          />
        </div>
      )}

      {editorState ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Edit Calendar Event</h3>
                <p className="mt-1 text-xs text-slate-400">Update schedule details and save directly to operations calendar.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditorState(null)}
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-300 md:col-span-2">
                Title
                <input
                  value={editorState.title}
                  onChange={(event) => handleEditorChange("title", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="text-xs text-slate-300">
                Status
                <select
                  value={editorState.status}
                  onChange={(event) => handleEditorChange("status", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="install">Install</option>
                  <option value="estimate">Estimate</option>
                  <option value="meeting">Meeting</option>
                </select>
              </label>

              <label className="text-xs text-slate-300">
                Crew Assigned
                <input
                  value={editorState.crewAssigned}
                  onChange={(event) => handleEditorChange("crewAssigned", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="text-xs text-slate-300 md:col-span-2">
                Job ID (optional)
                <input
                  value={editorState.jobId}
                  onChange={(event) => handleEditorChange("jobId", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="text-xs text-slate-300">
                Start
                <input
                  type="datetime-local"
                  value={editorState.start}
                  onChange={(event) => handleEditorChange("start", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="text-xs text-slate-300">
                End
                <input
                  type="datetime-local"
                  value={editorState.end}
                  onChange={(event) => handleEditorChange("end", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void handleDeleteEvent()}
                disabled={editing}
                className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
              >
                {editing ? "Working..." : "Delete Event"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditorState(null)}
                  disabled={editing}
                  className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  disabled={editing}
                  className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
                >
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .operations-calendar .fc {
          color: var(--color-slate-200);
        }
        .operations-calendar .fc-theme-standard td,
        .operations-calendar .fc-theme-standard th,
        .operations-calendar .fc-theme-standard .fc-scrollgrid {
          border-color: color-mix(in srgb, var(--color-slate-400) 25%, transparent);
        }
        .operations-calendar .fc-timegrid-slot,
        .operations-calendar .fc-col-header-cell,
        .operations-calendar .fc-daygrid-day {
          background: color-mix(in srgb, var(--color-slate-950) 68%, transparent);
        }
        .operations-calendar .fc-button {
          background: color-mix(in srgb, var(--color-white) 7%, transparent);
          border: 1px solid color-mix(in srgb, var(--color-slate-400) 30%, transparent);
        }
        .operations-calendar .fc-day-today {
          background: color-mix(in srgb, var(--color-cyan-400) 12%, transparent) !important;
        }
        .operations-calendar .fc-event {
          border: none;
          font-weight: 600;
          padding: 2px 4px;
        }
      `}</style>
    </section>
  );
}
