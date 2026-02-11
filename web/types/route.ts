export type RouteStop = {
  jobId: string;
  rank: number;
  address: string;
  lat: number;
  lng: number;
  customerName: string | null;
  scheduledAt: string | null;
  status: string | null;
};

export type RouteTotals = {
  meters: number;
  seconds: number;
  miles: number;
  minutes: number;
};

export type RouteDoc = {
  date: string;
  stopCount: number;
  stops: RouteStop[];
  optimized: boolean;
  totals: RouteTotals;
  polyline: {
    encoded: string;
    hasEncoded: boolean;
  };
  legs?: Array<{
    fromJobId?: string | null;
    toJobId?: string | null;
  }>;
  revenueTotal?: number;
  revenuePerStop?: number;
  revenuePerMile?: number;
  revenuePerHour?: number;
  fuelCost?: number;
  laborDriveCost?: number;
  routeCost?: number;
  profitEstimate?: number;
  efficiencyScore?: number;
};
