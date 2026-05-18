/** Start the front-facing camera and return the media stream. */
export async function startCamera(
  videoEl: HTMLVideoElement
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
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
