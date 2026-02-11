"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

type EstimatorMapProps = {
  onFeetChange: (feet: number) => void;
};

export const EstimatorMap = ({ onFeetChange }: EstimatorMapProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    loadGoogleMaps({ apiKey, libraries: ["drawing", "geometry"] })
      .then(() => {
        if (!mapRef.current || mapInstance.current) return;
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: { lat: 33.749, lng: -84.388 },
          zoom: 12,
          mapId: "ga-gutter-guys-estimator",
        });

        drawingManagerRef.current = new google.maps.drawing.DrawingManager({
          drawingMode: google.maps.drawing.OverlayType.POLYLINE,
          drawingControl: true,
          drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [google.maps.drawing.OverlayType.POLYLINE],
          },
          polylineOptions: {
            strokeColor: "#22d3ee",
            strokeWeight: 4,
          },
        });

        drawingManagerRef.current.setMap(mapInstance.current);

        google.maps.event.addListener(
          drawingManagerRef.current,
          "polylinecomplete",
          (polyline: google.maps.Polyline) => {
            if (polylineRef.current) {
              polylineRef.current.setMap(null);
            }

            polylineRef.current = polyline;
            const path = polyline.getPath();
            const meters = google.maps.geometry.spherical.computeLength(path);
            const feet = meters * 3.28084;
            onFeetChange(Number(feet.toFixed(1)));
          }
        );
      })
      .catch(() => undefined);
  }, [onFeetChange]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <div ref={mapRef} className="h-[420px] w-full" />
    </div>
  );
};
