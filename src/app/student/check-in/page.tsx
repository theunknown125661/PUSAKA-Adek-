"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { useCamera } from "@/lib/hooks/use-camera";
import { haversineDistance } from "@/lib/utils/haversine";
import { formatDistance, formatAccuracy } from "@/lib/utils/format";
import { detectFraudFlags } from "@/lib/utils/fraud-flags";
import { MapPin, Camera, CheckCircle, AlertTriangle, Loader2, RotateCcw, Send, Sunrise } from "lucide-react";

type Step = "location" | "selfie" | "review" | "submitting" | "done";

export default function CheckInPage() {
  const { profile } = useUserRole();
  const { position, error: geoError, loading: geoLoading, requestPosition } = useGeolocation();
  const { videoRef, preview, blob, active, error: camError, open, capture, retake, close } = useCamera();
  const router = useRouter();

  const [step, setStep] = useState<Step>("location");
  const [school, setSchool] = useState<{ latitude: number; longitude: number; radius_m: number } | null>(null);
  const [enrollment, setEnrollment] = useState<{ class_id: string; school_id: string } | null>(null);
  const [rewardRules, setRewardRules] = useState<{ attendance_start_time: string; attendance_end_time: string; early_cutoff_time: string } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [withinRadius, setWithinRadius] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    async function loadMeta() {
      const { data: enr } = await supabase.from("enrollments").select("class_id, classes(school_id)").eq("student_id", profile!.id).limit(1).single();
      if (!enr) return;
      const schoolId = (enr.classes as unknown as { school_id: string })?.school_id;
      setEnrollment({ class_id: enr.class_id, school_id: schoolId });

      const [schoolRes, rulesRes, todayRes] = await Promise.all([
        supabase.from("schools").select("latitude, longitude, radius_m").eq("id", schoolId).single(),
        supabase.from("reward_rules").select("attendance_start_time, attendance_end_time, early_cutoff_time").eq("school_id", schoolId).single(),
        supabase.from("attendance_logs").select("id").eq("student_id", profile!.id).eq("attendance_date", new Date().toISOString().split("T")[0]).limit(1),
      ]);
      if (schoolRes.data) setSchool(schoolRes.data);
      if (rulesRes.data) setRewardRules(rulesRes.data);
      if (todayRes.data && todayRes.data.length > 0) setAlreadySubmitted(true);
    }
    loadMeta();
  }, [profile]);

  useEffect(() => {
    if (position && school) {
      const d = haversineDistance(position.latitude, position.longitude, school.latitude, school.longitude);
      setDistance(d);
      setWithinRadius(d <= school.radius_m);
    }
  }, [position, school]);

  const isInTimeWindow = () => {
    if (!rewardRules) return true;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return timeStr >= rewardRules.attendance_start_time && timeStr <= rewardRules.attendance_end_time;
  };

  const isBeforeEarlyCutoff = () => {
    if (!rewardRules) return false;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return timeStr <= rewardRules.early_cutoff_time;
  };

  const handleSubmit = async () => {
    if (!profile || !position || !blob || !enrollment) return;
    setStep("submitting");
    setSubmitError("");

    const supabase = createClient();
    try {
      // Upload selfie
      const fileName = `${profile.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("attendance-selfies").upload(fileName, blob, { contentType: "image/jpeg" });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("attendance-selfies").getPublicUrl(fileName);
      const flags = detectFraudFlags({
        distanceM: distance || 0,
        radiusM: school?.radius_m || 200,
        accuracyM: position.accuracy,
        withinTimeWindow: isInTimeWindow(),
        hasSelfie: true,
        hasExistingToday: false,
      });

      const { error: insertErr } = await supabase.from("attendance_logs").insert({
        student_id: profile.id,
        class_id: enrollment.class_id,
        school_id: enrollment.school_id,
        attendance_date: new Date().toISOString().split("T")[0],
        submitted_at: new Date().toISOString(),
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy_m: Math.round(position.accuracy),
        distance_m: Math.round(distance || 0),
        within_radius: withinRadius,
        within_time_window: isInTimeWindow(),
        before_early_cutoff: isBeforeEarlyCutoff(),
        proof_image_url: urlData.publicUrl,
        status: "pending_teacher_view",
        fraud_flags: flags.length > 0 ? flags : null,
        device_info: navigator.userAgent.substring(0, 200),
      });
      if (insertErr) throw insertErr;

      close();
      setStep("done");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
      setStep("review");
    }
  };

  if (alreadySubmitted) {
    return (
      <div className="animate-fade-in text-center py-16">
        <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"><CheckCircle className="h-8 w-8 text-emerald-500" /></div>
        <h1 className="text-xl font-bold mb-2">Already Checked In</h1>
        <p className="text-muted-foreground text-sm mb-6">You have already submitted attendance for today.</p>
        <button onClick={() => router.push("/student")} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Back to Dashboard</button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="animate-fade-in text-center py-16">
        <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 animate-confetti-pop"><CheckCircle className="h-8 w-8 text-emerald-500" /></div>
        <h1 className="text-xl font-bold mb-2">Attendance Submitted! 🎉</h1>
        <p className="text-muted-foreground text-sm mb-6">Your check-in is pending review.</p>
        <button onClick={() => router.push("/student")} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
      <div><h1 className="text-xl font-bold">Daily Check-In</h1><p className="text-muted-foreground text-sm mt-1">Verify your location and take a selfie</p></div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {["Location", "Selfie", "Submit"].map((label, i) => {
          const stepIdx = i === 0 ? "location" : i === 1 ? "selfie" : "review";
          const steps: Step[] = ["location", "selfie", "review", "submitting"];
          const currentIdx = steps.indexOf(step);
          const isCompleted = currentIdx > i;
          const isCurrent = (i === 0 && step === "location") || (i === 1 && step === "selfie") || (i === 2 && (step === "review" || step === "submitting"));
          return (
            <div key={stepIdx} className="flex items-center gap-2 flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isCompleted ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"}`}>{isCompleted ? "✓" : i + 1}</div>
              <span className="text-xs font-medium hidden sm:block">{label}</span>
              {i < 2 && <div className="flex-1 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Location step */}
      {step === "location" && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <div className="text-center">
            <MapPin className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="font-semibold">Enable Location</h2>
            <p className="text-sm text-muted-foreground mt-1">We need to verify you are at school</p>
          </div>
          {geoError && <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">{geoError === "PERMISSION_DENIED" ? "Location permission denied. Please enable in browser settings." : "Unable to get location. Try again."}</div>}
          {position && distance !== null && (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 text-center ${withinRadius ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                <p className="text-2xl font-bold">{formatDistance(distance)}</p>
                <p className="text-sm text-muted-foreground">from school</p>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {withinRadius ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  <span className={`text-xs font-medium ${withinRadius ? "text-emerald-500" : "text-amber-500"}`}>{withinRadius ? "Inside radius" : "Outside radius"}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Accuracy: {formatAccuracy(position.accuracy)}</p>
              {isBeforeEarlyCutoff() && <div className="flex items-center justify-center gap-1.5 text-amber-500"><Sunrise className="h-4 w-4" /><span className="text-xs font-medium">Early Bird Bonus!</span></div>}
            </div>
          )}
          {!position ? (
            <button onClick={requestPosition} disabled={geoLoading} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {geoLoading ? "Getting location..." : "Get My Location"}
            </button>
          ) : (
            <button onClick={() => { setStep("selfie"); open(); }} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2">
              <Camera className="h-4 w-4" /> Next: Take Selfie
            </button>
          )}
        </div>
      )}

      {/* Selfie step */}
      {step === "selfie" && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <div className="text-center"><Camera className="h-10 w-10 text-primary mx-auto mb-3" /><h2 className="font-semibold">Take a Selfie</h2><p className="text-sm text-muted-foreground mt-1">Show that you are physically at school</p></div>
          {camError && <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">{camError}</div>}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${preview ? "hidden" : ""}`} style={{ transform: "scaleX(-1)" }} />
            {preview && <img src={preview} alt="Selfie preview" className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />}
          </div>
          <div className="flex gap-3">
            {!preview && active ? (
              <button onClick={capture} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"><Camera className="h-4 w-4" /> Capture</button>
            ) : preview ? (
              <>
                <button onClick={retake} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm flex items-center justify-center gap-2"><RotateCcw className="h-4 w-4" /> Retake</button>
                <button onClick={() => setStep("review")} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"><CheckCircle className="h-4 w-4" /> Use Photo</button>
              </>
            ) : (
              <button onClick={open} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">Open Camera</button>
            )}
          </div>
        </div>
      )}

      {/* Review step */}
      {(step === "review" || step === "submitting") && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-center">Review & Submit</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted rounded-xl p-3"><p className="text-xs text-muted-foreground">Distance</p><p className="font-medium">{formatDistance(distance || 0)}</p></div>
            <div className="bg-muted rounded-xl p-3"><p className="text-xs text-muted-foreground">Accuracy</p><p className="font-medium">{formatAccuracy(position?.accuracy || 0)}</p></div>
            <div className="bg-muted rounded-xl p-3"><p className="text-xs text-muted-foreground">In Radius</p><p className={`font-medium ${withinRadius ? "text-emerald-500" : "text-amber-500"}`}>{withinRadius ? "Yes" : "No"}</p></div>
            <div className="bg-muted rounded-xl p-3"><p className="text-xs text-muted-foreground">Time Window</p><p className={`font-medium ${isInTimeWindow() ? "text-emerald-500" : "text-amber-500"}`}>{isInTimeWindow() ? "Yes" : "No"}</p></div>
          </div>
          {preview && <img src={preview} alt="Selfie" className="w-full rounded-xl aspect-[4/3] object-cover" style={{ transform: "scaleX(-1)" }} />}
          {submitError && <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">{submitError}</div>}
          <button onClick={handleSubmit} disabled={step === "submitting"} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {step === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {step === "submitting" ? "Submitting..." : "Submit Attendance"}
          </button>
        </div>
      )}
    </div>
  );
}
