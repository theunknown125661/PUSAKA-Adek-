"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon path issues with Next.js/Webpack
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

interface LocationMapProps {
  latitude: number;
  longitude: number;
  radius_m: number;
  onLocationChange: (lat: number, lng: number) => void;
}

function LocationPicker({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMap({ latitude, longitude, radius_m, onLocationChange }: LocationMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[400px] w-full bg-muted animate-pulse rounded-xl" />;

  const center: [number, number] = [latitude || -6.2, longitude || 106.8]; // Default to Jakarta if 0

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-border relative z-0">
      <MapContainer center={center} zoom={16} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={icon} />
        <Circle
          center={[latitude, longitude]}
          pathOptions={{ fillColor: 'var(--primary)', color: 'var(--primary)', fillOpacity: 0.2 }}
          radius={radius_m}
        />
        <LocationPicker onLocationChange={onLocationChange} />
      </MapContainer>
      <div className="absolute top-2 right-2 z-[400] bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs font-medium pointer-events-none">
        Click anywhere to move pin
      </div>
    </div>
  );
}
