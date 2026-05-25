"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface CheckInMapProps {
  studentLat: number;
  studentLng: number;
  accuracy: number;
  schoolLat: number;
  schoolLng: number;
  schoolRadius: number;
  withinRadius: boolean;
}

export default function CheckInMap({
  studentLat,
  studentLng,
  accuracy,
  schoolLat,
  schoolLng,
  schoolRadius,
  withinRadius
}: CheckInMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Dynamically import leaflet at runtime (avoids SSR issues)
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      // Check if the container already has a map (StrictMode guard)
      if ((mapRef.current as any)._leaflet_id) {
        return;
      }

      // Create map
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: true,
      });

      // Tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // School geofence circle
      const geofenceColor = withinRadius ? "#22c55e" : "#ef4444";
      L.circle([schoolLat, schoolLng], {
        radius: schoolRadius,
        fillColor: geofenceColor,
        color: geofenceColor,
        fillOpacity: 0.12,
        weight: 2,
        dashArray: withinRadius ? undefined : "6 4",
      }).addTo(map);

      // GPS accuracy circle
      if (accuracy) {
        L.circle([studentLat, studentLng], {
          radius: accuracy,
          fillColor: "#6366f1",
          color: "#6366f1",
          fillOpacity: 0.06,
          weight: 1,
          dashArray: "4 4",
        }).addTo(map);
      }

      // Dashed line between student and school
      L.polyline(
        [[studentLat, studentLng], [schoolLat, schoolLng]],
        {
          color: withinRadius ? "#22c55e" : "#ef4444",
          weight: 2,
          dashArray: "8 6",
          opacity: 0.7,
        }
      ).addTo(map);

      // School marker
      const schoolIcon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#2563eb;color:white;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:3px solid white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m4 6 8-4 8 4v14H4V6z"/><path d="M12 22v-6"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/><path d="M16 15h.01"/><path d="M8 15h.01"/>
          </svg>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      L.marker([schoolLat, schoolLng], { icon: schoolIcon })
        .bindPopup("<b>School</b>")
        .addTo(map);

      // Student marker
      const studentIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#6366f1;color:white;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:3px solid white;">
          <span style="position:absolute;display:inline-flex;height:100%;width:100%;border-radius:50%;background:#818cf8;opacity:0.5;animation:leaflet-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:1;">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      L.marker([studentLat, studentLng], { icon: studentIcon })
        .bindPopup("<b>You are here</b>")
        .addTo(map);

      // Fit bounds to show both markers + geofence
      const bounds = L.latLngBounds([
        [studentLat, studentLng],
        [schoolLat, schoolLng],
      ]);
      const schoolPoint = L.latLng(schoolLat, schoolLng);
      bounds.extend(schoolPoint.toBounds(schoolRadius * 2));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });

      mapInstanceRef.current = map;
      setReady(true);

      // Add ping animation CSS
      if (!document.getElementById("leaflet-ping-style")) {
        const style = document.createElement("style");
        style.id = "leaflet-ping-style";
        style.textContent = `@keyframes leaflet-ping{75%,100%{transform:scale(2);opacity:0;}}`;
        document.head.appendChild(style);
      }
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [studentLat, studentLng, accuracy, schoolLat, schoolLng, schoolRadius, withinRadius]);

  return (
    <div style={{ position: "relative" }}>
      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          height: "300px",
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid var(--border, #e5e7eb)",
          zIndex: 0,
          background: "#f3f4f6",
        }}
      />

      {/* Legend overlay */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          zIndex: 1000,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(4px)",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "11px",
          lineHeight: "1.6",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column" as const,
          gap: "2px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
          <span style={{ color: "#374151" }}>You</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
          <span style={{ color: "#374151" }}>School</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: withinRadius ? "#22c55e" : "#ef4444",
              opacity: 0.3,
              display: "inline-block",
              border: `1.5px solid ${withinRadius ? "#22c55e" : "#ef4444"}`,
            }}
          />
          <span style={{ color: "#374151" }}>Allowed area</span>
        </div>
      </div>
    </div>
  );
}
