"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import type { RouteDoc } from "@/types/route";

type RouteMapProps = {
  route: RouteDoc | null;
};

export const RouteMap = ({ route }: RouteMapProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    loadGoogleMaps({ apiKey, libraries: ["geometry"] })
      .then(() => {
        if (!mapRef.current) return;
        if (!mapInstance.current) {
          mapInstance.current = new google.maps.Map(mapRef.current, {
            center: { lat: 33.749, lng: -84.388 },
            zoom: 10,
            mapId: "ga-gutter-guys-dashboard",
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!route || !mapInstance.current) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    if (route.polyline?.encoded) {
      const path = google.maps.geometry.encoding.decodePath(route.polyline.encoded);
      polylineRef.current = new google.maps.Polyline({
        path,
        strokeColor: "#38bdf8",
        strokeOpacity: 0.9,
        strokeWeight: 4,
      });
      polylineRef.current.setMap(mapInstance.current);

      const bounds = new google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      mapInstance.current.fitBounds(bounds);
    }

    route.stops.forEach((stop, index) => {
      const marker = new google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        label: {
          text: String(index + 1),
          color: "#0f172a",
          fontWeight: "600",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#facc15",
          fillOpacity: 0.95,
          strokeColor: "#0f172a",
          strokeWeight: 1,
          scale: 9,
        },
        map: mapInstance.current,
      });
      markersRef.current.push(marker);
    });
  }, [route]);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <div ref={mapRef} className="h-[420px] w-full" />
    </div>
  );
};
