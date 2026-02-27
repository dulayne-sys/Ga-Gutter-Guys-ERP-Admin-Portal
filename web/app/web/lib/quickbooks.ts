import { apiDisconnectQbo, apiGetQboStatus, apiStartQboAuth } from "@/lib/api";

export const getQuickBooksStatus = apiGetQboStatus;

export const startQuickBooksAuth = async () => {
  const result = await apiStartQboAuth({ returnPath: "/web/dashboard" });
  return result.authUrl;
};

export const disconnectQuickBooks = async () => {
  await apiDisconnectQbo();
};
