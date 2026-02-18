import {
  apiDisconnectGcal,
  apiGetGcalStatus,
  apiListGcalCalendars,
  apiSetGcalCalendar,
  apiStartGcalAuth,
  apiSyncEventToGcal,
  apiSyncGoogleToFirestore,
  type ApiError,
  type GcalCalendarListItem,
} from "@/lib/api";

type SyncPayload = {
  id: string;
  title: string;
  start: string;
  end: string;
  source?: "crm" | "google";
  status?: string;
  crewAssigned?: string;
  jobId?: string;
  googleEventId?: string | null;
};

export const connectGoogleCalendar = async () => {
  const result = await apiStartGcalAuth({ returnPath: "/web/calendar" });
  if (typeof window !== "undefined") {
    window.location.assign(result.authUrl);
  }
  return { connected: true, authUrl: result.authUrl };
};

export const syncEventToGoogle = async (event: SyncPayload) => {
  try {
    const result = await apiSyncEventToGcal(event);
    return { synced: result.synced, googleEventId: result.googleEventId };
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError?.status === 412) {
      return { synced: false, googleEventId: event.googleEventId ?? null };
    }
    throw error;
  }
};

export const syncGoogleToFirestore = async () => {
  const result = await apiSyncGoogleToFirestore();
  return { synced: result.synced, importedCount: result.importedCount };
};

export const disconnectGoogleCalendar = async () => {
  await apiDisconnectGcal();
  return { connected: false };
};

export const getGoogleCalendarStatus = () => apiGetGcalStatus();

export const listGoogleCalendars = () => apiListGcalCalendars();

export const setGoogleCalendar = (calendarId: string) => apiSetGcalCalendar({ calendarId });

export type GoogleCalendarListItem = GcalCalendarListItem;
