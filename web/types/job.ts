export type JobStop = {
  jobId: string;
  address: string;
  customerName: string | null;
  scheduledAt: string | null;
  status: string | null;
  priorityRank: number;
  lat: number;
  lng: number;
};
