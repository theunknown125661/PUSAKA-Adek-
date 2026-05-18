export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
}

export type GeoError = "PERMISSION_DENIED" | "POSITION_UNAVAILABLE" | "TIMEOUT" | "NOT_SUPPORTED";

/** Get the current position from the browser Geolocation API. */
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("NOT_SUPPORTED" as GeoError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        const errorMap: Record<number, GeoError> = {
          1: "PERMISSION_DENIED",
          2: "POSITION_UNAVAILABLE",
          3: "TIMEOUT",
        };
        reject(errorMap[err.code] || "POSITION_UNAVAILABLE");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}
