"use client";

import { useState, useCallback } from "react";
import { getCurrentPosition, type GeoPosition, type GeoError } from "@/lib/utils/geo";

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [loading, setLoading] = useState(false);

  const requestPosition = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
      return pos;
    } catch (err) {
      setError(err as GeoError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { position, error, loading, requestPosition };
}
