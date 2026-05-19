"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function AvatarUpload({ userId, currentUrl, onUploaded, onRemoved }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Image must be JPG, PNG, or WebP.");
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      setError("Image size must be under 5 MB.");
      return;
    }

    // Show local preview
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${userId}/avatar.${ext}`;

      // Upload (overwrite existing)
      const { error: uploadErr } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      // Append cache-bust timestamp
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      onUploaded(publicUrl);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed. Please try again.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onRemoved();
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="h-20 w-20 rounded-full bg-muted border-2 border-dashed border-border overflow-hidden shrink-0 flex items-center justify-center relative">
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
          {displayUrl ? (
            <img src={displayUrl} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            <Upload className="h-3.5 w-3.5" />
            {currentUrl ? "Change Photo" : "Upload Photo"}
          </button>

          {currentUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="px-4 py-2 rounded-xl bg-muted text-destructive text-xs font-bold hover:bg-destructive/10 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
