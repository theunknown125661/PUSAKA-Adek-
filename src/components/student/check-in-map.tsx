"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Custom SVG Icons for School and Student
const schoolIcon = L.divIcon({
  className: "custom-school-marker",
  html: `
    <div class="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white shadow-md border-2 border-white transform -translate-x-1/2 -translate-y-1/2">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m4 6 8-4 8 4v14H4V6z"/>
        <path d="M12 22v-6"/>
        <path d="M12 11h.01"/>
        <path d="M16 11h.01"/>
        <path d="M8 11h.01"/>
        <path d="M16 15h.01"/>
        <path d="M8 15h.01"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const studentIcon = L.divIcon({
  className: "custom-student-marker",
  html: `
    <div class="relative flex items-center justify-center w-9 h-9 rounded-full bg-indigo-600 text-white shadow-md border-2 border-white transform -translate-x-1/2 -translate-y-1/2">
      <span class="absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-60 animate-ping"></span>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

interface CheckInMapProps {
  studentLat: number;
  studentLng: number;
  accuracy: number;
  schoolLat: number;
  schoolLng: number;
  schoolRadius: number;
  withinRadius: boolean;
}

// Sub-component to fit map bounds to show both markers
function MapBoundsUpdater({
  studentLat,
  studentLng,
  schoolLat,
  schoolLng
}: {
  studentLat: number;
  studentLng: number;
  schoolLat: number;
  schoolLng: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (studentLat && studentLng && schoolLat && schoolLng) {
      const bounds = L.latLngBounds([
        [studentLat, studentLng],
        [schoolLat, schoolLng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [map, studentLat, studentLng, schoolLat, schoolLng]);

  return null;
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[260px] w-full bg-muted animate-pulse rounded-xl" />;
  }

  const center: [number, number] = [schoolLat, schoolLng];

  // School radius geofence styling based on student state
  const geofenceColor = withinRadius ? "var(--success)" : "var(--destructive)";
  
  return (
    <div className="h-[260px] w-full rounded-xl overflow-hidden border border-border relative z-0">
      <MapContainer center={center} zoom={15} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* School Geofence Area */}
        <Circle
          center={[schoolLat, schoolLng]}
          radius={schoolRadius}
          pathOptions={{ 
            fillColor: geofenceColor, 
            color: geofenceColor, 
            fillOpacity: 0.15,
            weight: 2
          }}
        />

        {/* GPS Accuracy Circle around Student */}
        {accuracy && (
          <Circle
            center={[studentLat, studentLng]}
            radius={accuracy}
            pathOptions={{
              fillColor: "#6366f1",
              color: "#6366f1",
              fillOpacity: 0.05,
              weight: 1,
              dashArray: "4 4"
            }}
          />
        )}

        {/* Markers */}
        <Marker position={[schoolLat, schoolLng]} icon={schoolIcon} />
        <Marker position={[studentLat, studentLng]} icon={studentIcon} />

        {/* Fit Bounds */}
        <MapBoundsUpdater
          studentLat={studentLat}
          studentLng={studentLng}
          schoolLat={schoolLat}
          schoolLng={schoolLng}
        />
      </MapContainer>
    </div>
  );
}
