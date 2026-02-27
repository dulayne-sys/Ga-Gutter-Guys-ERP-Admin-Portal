"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, firestore } from "@/lib/firebase";
import { EnterpriseIcon } from "@/components/EnterpriseIcon";
import { OperationsCalendar } from "../components/calendar/OperationsCalendar";
import { DataTable } from "../components/DataTable";
import { StatCard } from "../components/StatCard";
import CrudRecordModal, { type CrudFieldDefinition } from "../components/modals/CrudRecordModal";
import { dataLoader, type TableRow } from "../lib/dataLoader";
import { TABLE_DEFINITIONS } from "../lib/tableDefinitions";

type UserRole = "admin" | "sales" | "field" | "unknown";

type CalendarStop = {
  jobId: string;
  customerId: string;
  customerName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  arrivalWindow: string;
};

type RouteMetrics = {
  miles: number;
  minutes: number;
};

type AiInstruction = {
  order: number;
  customerName: string;
  address: string;
  eta: string;
  travelMinutes: number;
};

type AiRoutePlan = {
  planningDate: string;
  baselineStops: CalendarStop[];
  optimizedStops: CalendarStop[];
  baseline: RouteMetrics;
  optimized: RouteMetrics;
  savedMiles: number;
  savedMinutes: number;
  fuelSavings: number;
  laborSavings: number;
  totalSavings: number;
  instructions: AiInstruction[];
};

const scheduleFields: CrudFieldDefinition[] = [
  { name: "installDate", label: "Install Date", type: "date" },
  { name: "arrivalWindow", label: "Arrival Window", type: "text", placeholder: "8am - 12pm" },
  {
    name: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { label: "Scheduled", value: "scheduled" },
      { label: "In Progress", value: "in_progress" },
      { label: "Completed", value: "completed" },
      { label: "On Hold", value: "on_hold" },
    ],
  },
  { name: "crew", label: "Crew UIDs (comma separated)", type: "text", placeholder: "uid1, uid2" },
  { name: "jobNotes", label: "Calendar Notes", type: "textarea" },
];

const splitCsv = (value: string): string[] =>
  value.split(",").map((part) => part.trim()).filter(Boolean);

const toDateValue = (value: unknown) => {
  if (!value) return "";
  const source = typeof value === "object" && value && "toDate" in value
    ? (value as { toDate: () => Date }).toDate()
    : value;
  const date = new Date(String(source));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const toFormValues = (row: TableRow | null): Record<string, string> => ({
  installDate: row?.schedule && typeof row.schedule === "object"
    ? toDateValue((row.schedule as { installDate?: unknown }).installDate)
    : "",
  arrivalWindow: row?.schedule && typeof row.schedule === "object"
    ? String((row.schedule as { arrivalWindow?: string }).arrivalWindow ?? "")
    : "",
  status: String(row?.status ?? "scheduled"),
  crew: row?.schedule && typeof row.schedule === "object"
    ? ((row.schedule as { crew?: string[] }).crew ?? []).join(", ")
    : "",
  jobNotes: String(row?.jobNotes ?? ""),
});

const toRadians = (value: number) => (value * Math.PI) / 180;

const round1 = (value: number) => Math.round(value * 10) / 10;

const round2 = (value: number) => Math.round(value * 100) / 100;

const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
};

const estimateLegMiles = (from: CalendarStop, to: CalendarStop) => {
  if (from.lat != null && from.lng != null && to.lat != null && to.lng != null) {
    return haversineMiles(from.lat, from.lng, to.lat, to.lng);
  }
  return 6.8;
};

const computeMetrics = (stops: CalendarStop[]): RouteMetrics => {
  if (stops.length <= 1) {
    return { miles: 0, minutes: 0 };
  }

  let miles = 0;
  for (let index = 1; index < stops.length; index += 1) {
    miles += estimateLegMiles(stops[index - 1], stops[index]);
  }

  const minutes = (miles / 28) * 60;
  return {
    miles: round1(miles),
    minutes: Math.round(minutes),
  };
};

const optimizeStops = (stops: CalendarStop[]): CalendarStop[] => {
  if (stops.length <= 2) {
    return [...stops];
  }

  const geoStops = stops.filter((stop) => stop.lat != null && stop.lng != null);
  if (geoStops.length < 2) {
    return [...stops].sort((left, right) => left.address.localeCompare(right.address));
  }

  const remaining = [...stops];
  const optimized: CalendarStop[] = [];

  const first = remaining.shift();
  if (!first) return stops;
  optimized.push(first);

  while (remaining.length) {
    const current = optimized[optimized.length - 1];
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = estimateLegMiles(current, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    optimized.push(next);
  }

  return optimized;
};

const formatEta = (minutesFromStart: number) => {
  const startHour = 8;
  const totalMinutes = startHour * 60 + minutesFromStart;
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

const buildInstructions = (stops: CalendarStop[]): AiInstruction[] => {
  const instructions: AiInstruction[] = [];
  let elapsedMinutes = 0;

  for (let index = 0; index < stops.length; index += 1) {
    if (index > 0) {
      elapsedMinutes += Math.round((estimateLegMiles(stops[index - 1], stops[index]) / 28) * 60);
    }

    instructions.push({
      order: index + 1,
      customerName: stops[index].customerName,
      address: stops[index].address,
      eta: formatEta(elapsedMinutes),
      travelMinutes: index === 0 ? 0 : Math.round((estimateLegMiles(stops[index - 1], stops[index]) / 28) * 60),
    });

    elapsedMinutes += 45;
  }

  return instructions;
};

const buildDirectionsEmbedUrl = (stops: CalendarStop[], mapsApiKey: string) => {
  if (!mapsApiKey || stops.length < 2) return "";

  const origin = encodeURIComponent(stops[0].address);
  const destination = encodeURIComponent(stops[stops.length - 1].address);
  const waypointStops = stops.slice(1, -1).slice(0, 8);
  const waypoints = waypointStops.map((stop) => encodeURIComponent(stop.address)).join("|");

  const url = new URL("https://www.google.com/maps/embed/v1/directions");
  url.searchParams.set("key", mapsApiKey);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  if (waypoints) {
    url.searchParams.set("waypoints", waypoints);
  }
  url.searchParams.set("mode", "driving");

  return url.toString();
};

const localYmdNow = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function CalendarPage() {
  const [jobs, setJobs] = useState<TableRow[]>([]);
  const [customers, setCustomers] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("unknown");
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiRoutePlan | null>(null);
  const [todayYmd, setTodayYmd] = useState("");

  const planningDate = dateFilter || todayYmd;
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const canEditSelected = useMemo(() => {
    if (!selectedRow) return false;
    if (currentUserRole === "admin") return true;
    if (currentUserRole !== "field" || !currentUserUid) return false;

    const crew = selectedRow.schedule && typeof selectedRow.schedule === "object"
      ? (selectedRow.schedule as { crew?: string[] }).crew
      : undefined;

    return Array.isArray(crew) && crew.includes(currentUserUid);
  }, [selectedRow, currentUserRole, currentUserUid]);

  const scheduledJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!job.schedule || typeof job.schedule !== "object") return false;
      const installDate = (job.schedule as { installDate?: unknown }).installDate;
      if (!installDate) return false;

      if (!dateFilter) return true;
      return toDateValue(installDate) === dateFilter;
    });
  }, [jobs, dateFilter]);

  const customerById = useMemo(() => {
    const map = new Map<string, TableRow>();
    customers.forEach((customer) => {
      const customerId = String(customer.id ?? "");
      if (customerId) {
        map.set(customerId, customer);
      }
    });
    return map;
  }, [customers]);

  const aiStopsForPlanningDate = useMemo(() => {
    return jobs
      .filter((job) => {
        if (!job.schedule || typeof job.schedule !== "object") return false;
        const installDate = (job.schedule as { installDate?: unknown }).installDate;
        if (!installDate) return false;
        return toDateValue(installDate) === planningDate;
      })
      .map((job) => {
        const customerId = String(job.customerId ?? "");
        const customer = customerById.get(customerId);
        const serviceAddress = customer?.serviceAddress as
          | { street?: string; city?: string; state?: string; zip?: string; lat?: number; lng?: number }
          | undefined;

        const street = String(serviceAddress?.street ?? "").trim();
        const city = String(serviceAddress?.city ?? "").trim();
        const state = String(serviceAddress?.state ?? "").trim();
        const zip = String(serviceAddress?.zip ?? "").trim();
        const assembledAddress = [street, city, state, zip].filter(Boolean).join(", ");

        return {
          jobId: String(job.id ?? ""),
          customerId,
          customerName: String(customer?.name ?? customerId ?? "Customer"),
          address: assembledAddress || "Address unavailable",
          lat: typeof serviceAddress?.lat === "number" ? serviceAddress.lat : null,
          lng: typeof serviceAddress?.lng === "number" ? serviceAddress.lng : null,
          arrivalWindow: job.schedule && typeof job.schedule === "object"
            ? String((job.schedule as { arrivalWindow?: string }).arrivalWindow ?? "")
            : "",
        } as CalendarStop;
      })
      .filter((stop) => stop.address !== "Address unavailable");
  }, [jobs, customerById, planningDate]);

  const mapEmbedUrl = useMemo(() => {
    if (!aiPlan) return "";
    return buildDirectionsEmbedUrl(aiPlan.optimizedStops, mapsApiKey);
  }, [aiPlan, mapsApiKey]);

  const stats = useMemo(() => {
    if (!todayYmd) {
      return {
        dueToday: 0,
        unscheduled: 0,
        inProgress: 0,
        onHold: 0,
      };
    }

    const dueToday = jobs.filter((job) => {
      if (!job.schedule || typeof job.schedule !== "object") return false;
      const installDate = (job.schedule as { installDate?: unknown }).installDate;
      return toDateValue(installDate) === todayYmd;
    }).length;

    const unscheduled = jobs.filter((job) => {
      if (!job.schedule || typeof job.schedule !== "object") return true;
      const installDate = (job.schedule as { installDate?: unknown }).installDate;
      return !installDate;
    }).length;

    const inProgress = jobs.filter((job) => String(job.status ?? "") === "in_progress").length;
    const onHold = jobs.filter((job) => String(job.status ?? "") === "on_hold").length;

    return { dueToday, unscheduled, inProgress, onHold };
  }, [jobs, todayYmd]);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobRows, customerRows] = await Promise.all([
        dataLoader.getJobs(),
        dataLoader.getCustomers(),
      ]);
      setJobs(jobRows);
      setCustomers(customerRows);
      setSelectedRow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  useEffect(() => {
    setTodayYmd(localYmdNow());
  }, []);

  useEffect(() => {
    if (!auth || !firestore) return;
    const db = firestore;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUserRole("unknown");
        setCurrentUserUid(null);
        return;
      }

      setCurrentUserUid(user.uid);

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const role = String(userDoc.data()?.role ?? "unknown") as UserRole;
        if (role === "admin" || role === "sales" || role === "field") {
          setCurrentUserRole(role);
        } else {
          setCurrentUserRole("unknown");
        }
      } catch {
        setCurrentUserRole("unknown");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSaveSchedule = async (values: Record<string, string>) => {
    if (!selectedRow?.id || !canEditSelected) return;

    try {
      setSubmitting(true);
      await dataLoader.updateDocument("jobs", String(selectedRow.id), {
        status: values.status || "scheduled",
        schedule: {
          installDate: values.installDate ? new Date(values.installDate) : null,
          arrivalWindow: values.arrivalWindow || "",
          crew: splitCsv(values.crew || ""),
        },
        jobNotes: values.jobNotes || "",
      });

      setModalOpen(false);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  const runAiRoutePlanner = async () => {
    setAiPlanning(true);
    try {
      const baselineStops = [...aiStopsForPlanningDate];
      const optimizedStops = optimizeStops(baselineStops);
      const baseline = computeMetrics(baselineStops);
      const optimized = computeMetrics(optimizedStops);

      const savedMiles = Math.max(0, round1(baseline.miles - optimized.miles));
      const savedMinutes = Math.max(0, baseline.minutes - optimized.minutes);
      const fuelSavings = round2(savedMiles * 0.67);
      const laborSavings = round2((savedMinutes / 60) * 34);
      const totalSavings = round2(fuelSavings + laborSavings);

      setAiPlan({
        planningDate,
        baselineStops,
        optimizedStops,
        baseline,
        optimized,
        savedMiles,
        savedMinutes,
        fuelSavings,
        laborSavings,
        totalSavings,
        instructions: buildInstructions(optimizedStops),
      });
    } finally {
      setAiPlanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Calendar</h1>
          <p className="mt-1 text-sm text-slate-400">Daily schedule, routing, and crew planning.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <a
            href="#ai-route-planner"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25"
          >
            <EnterpriseIcon name="roadmap" className="h-4 w-4" />
            AI Route Planner
          </a>
          <button type="button" onClick={() => void loadJobs()} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
            Reload
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Due Today" value={String(stats.dueToday)} sublabel="Install appointments" />
        <StatCard label="Unscheduled" value={String(stats.unscheduled)} sublabel="Need install dates" />
        <StatCard label="In Progress" value={String(stats.inProgress)} sublabel="On-site now" />
        <StatCard label="On Hold" value={String(stats.onHold)} sublabel="Blocked jobs" />
      </div>

      <section id="ai-route-planner" className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">AI Route Planning</h2>
            <p className="mt-1 text-sm text-slate-400">Generate optimized stop order, map visualization, ROI savings, and crew instructions.</p>
          </div>
          <button
            type="button"
            onClick={() => void runAiRoutePlanner()}
            disabled={aiPlanning || aiStopsForPlanningDate.length < 2}
            className="rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiPlanning ? "Planning..." : "Run AI Route Planner"}
          </button>
        </div>

        <div className="text-xs text-slate-300">
          Planning Date: <span className="font-semibold text-white">{planningDate}</span>
          <span className="ml-3">Eligible Stops: <span className="font-semibold text-white">{aiStopsForPlanningDate.length}</span></span>
        </div>

        {!aiPlan ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">
            Select a date with at least 2 scheduled jobs, then run the AI planner.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Baseline" value={`${aiPlan.baseline.miles} mi`} sublabel={`${aiPlan.baseline.minutes} min`} />
              <StatCard label="Optimized" value={`${aiPlan.optimized.miles} mi`} sublabel={`${aiPlan.optimized.minutes} min`} />
              <StatCard label="Time Saved" value={`${aiPlan.savedMinutes} min`} sublabel={`${aiPlan.savedMiles} mi reduced`} />
              <StatCard label="ROI" value={`$${aiPlan.totalSavings.toFixed(2)}`} sublabel={`Fuel $${aiPlan.fuelSavings.toFixed(2)} + Labor $${aiPlan.laborSavings.toFixed(2)}`} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
                {mapEmbedUrl ? (
                  <iframe
                    title="AI Optimized Route Map"
                    src={mapEmbedUrl}
                    className="h-[320px] w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="grid h-[320px] place-items-center text-sm text-slate-400">
                    Map preview unavailable. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and ensure route has at least 2 valid addresses.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
                <h3 className="text-sm font-semibold text-white">Route Instructions</h3>
                <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1 text-xs text-slate-200">
                  {aiPlan.instructions.map((instruction) => (
                    <div key={`${instruction.order}-${instruction.customerName}`} className="rounded-lg border border-white/10 bg-white/5 p-2">
                      <p className="font-semibold text-white">{instruction.order}. {instruction.customerName}</p>
                      <p className="text-slate-300">ETA: {instruction.eta}</p>
                      <p className="text-slate-400">{instruction.address}</p>
                      {instruction.travelMinutes > 0 ? (
                        <p className="text-cyan-200">Travel from prior stop: {instruction.travelMinutes} min</p>
                      ) : (
                        <p className="text-cyan-200">Route start</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        Role: <span className="font-semibold text-white">{currentUserRole}</span>
        {selectedRow?.id ? <span className="ml-3">Selected Job: <span className="font-semibold text-white">{String(selectedRow.id)}</span></span> : null}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!canEditSelected || submitting}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit Schedule
          </button>
        </div>
      </div>

      <DataTable
        title="Scheduled Jobs"
        columns={TABLE_DEFINITIONS.calendar}
        rows={scheduledJobs}
        loading={loading}
        onRowClick={setSelectedRow}
        highlightRowId={String(selectedRow?.id ?? "")}
      />

      <OperationsCalendar />

      {modalOpen ? (
        <CrudRecordModal
          mode="edit"
          title="Update Job Schedule"
          fields={scheduleFields}
          initialValues={toFormValues(selectedRow)}
          submitting={submitting}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSaveSchedule}
        />
      ) : null}
    </div>
  );
}
