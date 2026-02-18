"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";

type ManualDrawingToolProps = {
  address: string;
  value: number;
  onMeasured: (feet: number) => void;
};

export function ManualDrawingTool({ address, value, onMeasured }: ManualDrawingToolProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const drawingManager = useRef<google.maps.drawing.DrawingManager | null>(null);
  const lines = useRef<google.maps.Polyline[]>([]);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const normalizedAddress = useMemo(() => address.trim(), [address]);

  const recenterToAddress = (nextAddress: string) => {
    if (!nextAddress || !map.current) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: nextAddress }, (results, status) => {
      if (status === "OK" && results?.[0] && map.current) {
        map.current.setCenter(results[0].geometry.location);
        map.current.setZoom(20);
        setGeocodeError(null);
        return;
      }

      setGeocodeError(
        "Unable to locate this address on the map. Confirm address fields and Maps key restrictions (Maps JavaScript API + Geocoding API + allowed referrer)."
      );
    });
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) {
      if (!apiKey) {
        setInitializationError("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
      }
      return;
    }

    let active = true;

    const init = async () => {
      try {
        setOptions({
          key: apiKey,
          v: "weekly",
          libraries: ["drawing", "geometry", "places"],
        });

        await Promise.all([
          importLibrary("maps"),
          importLibrary("drawing"),
          importLibrary("geometry"),
          importLibrary("places"),
        ]);
        if (!active || !mapRef.current || map.current) return;

        map.current = new google.maps.Map(mapRef.current, {
          center: { lat: 33.749, lng: -84.388 },
          zoom: 19,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          disableDefaultUI: false,
        });

        drawingManager.current = new google.maps.drawing.DrawingManager({
          drawingMode: google.maps.drawing.OverlayType.POLYLINE,
          drawingControl: true,
          drawingControlOptions: {
            drawingModes: [google.maps.drawing.OverlayType.POLYLINE],
          },
          polylineOptions: {
            editable: true,
            clickable: true,
            geodesic: true,
            strokeColor: "#a78bfa",
            strokeOpacity: 0.9,
            strokeWeight: 4,
          },
          map: map.current,
        });

        const recalculate = () => {
          if (!window.google?.maps?.geometry) return;
          const totalMeters = lines.current.reduce((sum, line) => {
            return sum + google.maps.geometry.spherical.computeLength(line.getPath());
          }, 0);
          const totalFeet = Number((totalMeters * 3.28084).toFixed(1));
          onMeasured(totalFeet);
        };

        google.maps.event.addListener(drawingManager.current, "polylinecomplete", (polyline: google.maps.Polyline) => {
          lines.current.push(polyline);
          google.maps.event.addListener(polyline.getPath(), "set_at", recalculate);
          google.maps.event.addListener(polyline.getPath(), "insert_at", recalculate);
          google.maps.event.addListener(polyline.getPath(), "remove_at", recalculate);
          recalculate();
        });

        if (normalizedAddress) {
          recenterToAddress(normalizedAddress);
        }
      } catch (error) {
        setInitializationError(error instanceof Error ? error.message : "Failed to initialize map drawing tool.");
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, [onMeasured]);

  useEffect(() => {
    if (!map.current || !normalizedAddress) return;
    recenterToAddress(normalizedAddress);
  }, [normalizedAddress]);

  const clearAll = () => {
    lines.current.forEach((line) => line.setMap(null));
    lines.current = [];
    onMeasured(0);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Manual Drawing Tool</h2>
          <p className="text-sm text-slate-400">Draw each gutter run as a polyline directly on the satellite map.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-indigo-300/30 bg-indigo-400/10 px-3 py-2 text-xs text-indigo-100">
            Total: {value.toFixed(1)} ft
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200"
          >
            Clear
          </button>
        </div>
      </div>

      {initializationError ? (
        <div className="mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {initializationError}
        </div>
      ) : null}

      {geocodeError ? (
        <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {geocodeError}
        </div>
      ) : null}

      <div ref={mapRef} className="h-[520px] w-full rounded-2xl border border-white/10" />
    </section>
  );
}
