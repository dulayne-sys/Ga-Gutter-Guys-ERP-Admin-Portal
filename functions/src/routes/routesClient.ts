export interface RouteTotals {
  meters: number;
  seconds: number;
  miles: number;
  minutes: number;
}

export interface RouteLegSummary {
  fromJobId: string | null;
  toJobId: string | null;
  meters: number;
  seconds: number;
  miles: number;
  minutes: number;
}

export interface RoutesApiResult {
  encodedPolyline: string;
  legs: RouteLegSummary[];
  totals: RouteTotals;
  optimizedOrder: number[] | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutesApiRequest {
  origin: { location: { latLng: LatLng } };
  destination: { location: { latLng: LatLng } };
  intermediates: Array<{ location: { latLng: LatLng } }>;
  travelMode: "DRIVE";
  optimizeWaypointOrder?: boolean;
  polylineQuality: "OVERVIEW";
  polylineEncoding: "ENCODED_POLYLINE";
}

const toMetersToMiles = (meters: number): number => meters / 1609.34;
const toSecondsToMinutes = (seconds: number): number => seconds / 60;

const parseDurationSeconds = (duration: string | undefined): number => {
  if (!duration) return 0;
  const trimmed = duration.endsWith("s") ? duration.slice(0, -1) : duration;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 0;
};

export const buildOptimizeRouteRequest = (
  home: LatLng,
  stops: LatLng[],
  returnHome: boolean,
  respectRanks: boolean,
): RoutesApiRequest => {
  const intermediates = stops.map((stop) => ({ location: { latLng: stop } }));

  return {
    origin: { location: { latLng: home } },
    destination: { location: { latLng: returnHome ? home : stops[stops.length - 1] } },
    intermediates,
    travelMode: "DRIVE",
    optimizeWaypointOrder: !respectRanks,
    polylineQuality: "OVERVIEW",
    polylineEncoding: "ENCODED_POLYLINE",
  };
};

export const callRoutesComputeRoutes = async (request: RoutesApiRequest, apiKey: string) => {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration,routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Routes API error: ${response.status} ${text}`);
  }

  return response.json();
};

export const normalizeRouteResponse = (payload: any): RoutesApiResult => {
  const route = payload?.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline || "";
  const routeMeters = typeof route?.distanceMeters === "number" ? route.distanceMeters : 0;
  const routeSeconds = parseDurationSeconds(route?.duration);
  const totals: RouteTotals = {
    meters: routeMeters,
    seconds: routeSeconds,
    miles: Number(toMetersToMiles(routeMeters).toFixed(2)),
    minutes: Number(toSecondsToMinutes(routeSeconds).toFixed(1)),
  };

  const legs: RouteLegSummary[] = (route?.legs || []).map((leg: any) => {
    const meters = typeof leg?.distanceMeters === "number" ? leg.distanceMeters : 0;
    const seconds = parseDurationSeconds(leg?.duration);

    return {
      fromJobId: null,
      toJobId: null,
      meters,
      seconds,
      miles: Number(toMetersToMiles(meters).toFixed(2)),
      minutes: Number(toSecondsToMinutes(seconds).toFixed(1)),
    };
  });

  const optimizedOrder = Array.isArray(route?.optimizedIntermediateWaypointIndex)
    ? route.optimizedIntermediateWaypointIndex as number[]
    : null;

  return { encodedPolyline, legs, totals, optimizedOrder };
};
