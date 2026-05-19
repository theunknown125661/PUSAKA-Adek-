"use client";

import { useState, useRef, useCallback } from "react";
import { startCamera, captureFrame, stopCamera } from "@/lib/utils/camera";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [active, setActive] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitializingRef = useRef(false);

  const open = useCallback(async () => {
    if (!videoRef.current || isInitializingRef.current) return;
    isInitializingRef.current = true;
    setError(null);
    setInitializing(true);
    
    // Explicit check for mobile/network HTTP blocking
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost") {
      setError("This browser cannot access the camera here (HTTPS required).");
      setInitializing(false);
      return;
    }

    try {
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      setActive(true);
    } catch (err: any) {
      console.error("Camera Error Details:", err);
      const name = err?.name || "";
      if (name === "NotAllowedError") {
        setError("Camera access is blocked. Enable it in browser site settings.");
      } else if (name === "NotFoundError") {
        setError("No camera hardware found on this device.");
      } else {
        setError(`Camera could not start (${name}). Try switching browser or reloading.`);
      }
    } finally {
      isInitializingRef.current = false;
      setInitializing(false);
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

  return { videoRef, preview, blob, active, initializing, error, open, capture, retake, close };
}
