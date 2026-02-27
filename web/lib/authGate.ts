import { auth } from "./firebase";

export type AuthGateError = Error & { status?: number };

export const requireUser = () => {
  if (!auth) {
    const error = new Error("Authentication unavailable in this environment.") as AuthGateError;
    error.status = 401;
    throw error;
  }

  const user = auth.currentUser;
  if (!user) {
    const error = new Error("Authentication required.") as AuthGateError;
    error.status = 401;
    throw error;
  }

  return user;
};

export const getToken = async (): Promise<string | null> => {
  if (!auth || !auth.currentUser) {
    return null;
  }

  return auth.currentUser.getIdToken();
};
