"use client";

import { useState, useRef, useCallback } from "react";
import { startCamera, captureFrame, stopCamera } from "@/lib/utils/camera";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    if (!videoRef.current) return;
    setError(null);
    try {
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError("Camera permission denied or unavailable.");
    }
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const b = await captureFrame(videoRef.current);
      setBlob(b);
      setPreview(URL.createObjectURL(b));
      // Stop camera after capturing
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
      }
      setActive(false);
    } catch {
      setError("Failed to capture photo.");
    }
  }, []);

  const retake = useCallback(async () => {
    setPreview(null);
    setBlob(null);
    await open();
  }, [open]);

  const close = useCallback(() => {
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
    setActive(false);
    setPreview(null);
    setBlob(null);
  }, []);

  return { videoRef, preview, blob, active, error, open, capture, retake, close };
}
