"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ThemePreference = "auto" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "web-theme-preference";

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getFallbackThemeByHour = (): ResolvedTheme => {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7 ? "dark" : "light";
};

const getAutoThemeByLocation = async (): Promise<ResolvedTheme> => {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return getFallbackThemeByHour();
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 4000,
      maximumAge: 10 * 60 * 1000,
      enableHighAccuracy: false,
    });
  }).catch(() => null);

  if (!position) {
    return getFallbackThemeByHour();
  }

  const { latitude, longitude } = position.coords;
  const apiUrl = `https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&formatted=0`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return getFallbackThemeByHour();
    }

    const payload = (await response.json()) as {
      status?: string;
      results?: { sunrise?: string; sunset?: string };
    };

    if (payload.status !== "OK" || !payload.results?.sunrise || !payload.results?.sunset) {
      return getFallbackThemeByHour();
    }

    const sunrise = new Date(payload.results.sunrise);
    const sunset = new Date(payload.results.sunset);
    const now = new Date();

    if (Number.isNaN(sunrise.getTime()) || Number.isNaN(sunset.getTime())) {
      return getFallbackThemeByHour();
    }

    return now < sunrise || now > sunset ? "dark" : "light";
  } catch {
    return getFallbackThemeByHour();
  }
};

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "auto" || stored === "light" || stored === "dark") return stored;
  return "light";
}

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const resolvedRef = useRef(resolvedTheme);

  useEffect(() => {
    resolvedRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  useEffect(() => {
    let active = true;

    const applyResolvedTheme = async () => {
      const nextTheme = preference === "auto" ? await getAutoThemeByLocation() : preference;
      if (active) setResolvedTheme(nextTheme);
    };

    void applyResolvedTheme();
    return () => { active = false; };
  }, [preference]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(resolvedTheme === "light" ? "theme-light" : "theme-dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((current) => {
      if (current === "auto") {
        return resolvedRef.current === "dark" ? "light" : "dark";
      }
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
      toggleTheme,
    }),
    [preference, resolvedTheme, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return context;
}
