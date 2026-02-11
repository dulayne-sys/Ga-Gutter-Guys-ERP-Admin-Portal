let mapsLoader: Promise<typeof google> | null = null;

type LoadOptions = {
  apiKey: string;
  libraries?: string[];
};

export const loadGoogleMaps = ({ apiKey, libraries = [] }: LoadOptions): Promise<typeof google> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (window.google && window.google.maps) {
    return Promise.resolve(window.google);
  }

  if (mapsLoader) {
    return mapsLoader;
  }

  mapsLoader = new Promise((resolve, reject) => {
    const callbackName = `gmaps_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const libs = libraries.length ? `&libraries=${libraries.join(",")}` : "";

    const callbackWindow = window as unknown as Window & Record<string, () => void>;
    callbackWindow[callbackName] = () => {
      resolve(window.google);
      delete callbackWindow[callbackName];
    };

    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${libs}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));

    document.head.appendChild(script);
  });

  return mapsLoader;
};
