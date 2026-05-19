/** Start the front-facing camera and return the media stream. */
export async function startCamera(
  videoEl: HTMLVideoElement
): Promise<MediaStream> {
  // Use very permissive constraints to avoid OverconstrainedError on some devices
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });
  videoEl.srcObject = stream;
  try {
    await videoEl.play();
  } catch (err: any) {
    if (err.name !== "AbortError") {
      console.warn("Video play error:", err);
    }
  }
  return stream;
}

/** Capture a frame from the video element and return it as a Blob. */
export function captureFrame(videoEl: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas context unavailable"));
      return;
    }
    ctx.drawImage(videoEl, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to capture frame"));
      },
      "image/jpeg",
      0.85
    );
  });
}

/** Stop all tracks on a media stream. */
export function stopCamera(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}
