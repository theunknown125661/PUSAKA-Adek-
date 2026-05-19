"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { useCamera } from "@/lib/hooks/use-camera";
import { useTranslation } from "@/lib/i18n/use-translation";
import { haversineDistance } from "@/lib/utils/haversine";
import { formatDistance, formatAccuracy } from "@/lib/utils/format";
import { detectFraudFlags } from "@/lib/utils/fraud-flags";

import { MapPin, Camera, Clock, Gift, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { StatefulButton, type ButtonState } from "@/components/ui/stateful-button";
import { RequirementItem, type RequirementStatus } from "@/components/ui/requirement-item";
import { ValidationSummary, type ValidationError } from "@/components/ui/validation-summary";
import { AlertBanner } from "@/components/ui/alert-banner";
import { toast } from "sonner";

export default function CheckInPage() {
  const { profile } = useUserRole();
  const { t, interpolate, isClient } = useTranslation();
  const { position, error: geoError, loading: geoLoading, requestPosition } = useGeolocation();
  const { videoRef, preview, blob, active, initializing, error: camError, open, capture, retake, close } = useCamera();
  const router = useRouter();

  const [school, setSchool] = useState<{ latitude: number; longitude: number; radius_m: number } | null>(null);
  const [enrollment, setEnrollment] = useState<{ class_id: string; school_id: string } | null>(null);
  const [rewardRules, setRewardRules] = useState<{ attendance_start_time: string; attendance_end_time: string; early_cutoff_time: string; base_reward: number; early_bonus: number } | null>(null);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [withinRadius, setWithinRadius] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  
  const [submitState, setSubmitState] = useState<ButtonState>("idle");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

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
        supabase.from("reward_rules").select("*").eq("school_id", schoolId).single(),
        supabase.from("attendance_logs").select("id").eq("student_id", profile!.id).eq("attendance_date", new Date().toISOString().split("T")[0]).limit(1),
      ]);
      if (schoolRes.data) setSchool(schoolRes.data);
      if (rulesRes.data) setRewardRules(rulesRes.data as any);
      if (todayRes.data && todayRes.data.length > 0) setAlreadySubmitted(true);
    }
    loadMeta();
  }, [profile]);

  useEffect(() => {
    // Automatically start camera on mount if not active
    if (isClient && !active && !preview) {
      open();
    }
    // Auto request position if we don't have it yet
    if (isClient && !position && !geoLoading && !geoError) {
       requestPosition();
    }
  }, [isClient, active, preview, position, geoLoading, geoError]);

  useEffect(() => {
    if (position && school) {
      const d = haversineDistance(position.latitude, position.longitude, school.latitude, school.longitude);
      setDistance(d);
      setWithinRadius(d <= school.radius_m);
    }
  }, [position, school]);

  const isInTimeWindow = () => {
    if (!rewardRules) return true; // Default to true while loading
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

  // Requirement status calculators
  const getRadiusStatus = (): RequirementStatus => {
    if (geoError) return "blocked";
    if (!position || distance === null) return "pending";
    return withinRadius ? "complete" : "blocked";
  };

  const getSelfieStatus = (): RequirementStatus => {
    if (camError) return "blocked";
    return preview ? "complete" : "pending";
  };

  const getAccuracyStatus = (): RequirementStatus => {
    if (!position) return "pending";
    if (position.accuracy > 100) return "blocked";
    if (position.accuracy > 50) return "warning";
    return "complete";
  };

  const getTimeStatus = (): RequirementStatus => {
    if (!rewardRules) return "pending";
    return isInTimeWindow() ? "complete" : "blocked";
  };

  const validateAll = () => {
    const errors: ValidationError[] = [];
    
    if (getRadiusStatus() === "blocked") {
      errors.push({ id: "section-location", message: geoError ? t.checkin.errors.weakGps : interpolate(t.checkin.errors.outsideRadius, { radius: `${school?.radius_m || 200}m` }) });
    }
    if (getSelfieStatus() === "blocked" || !blob) {
      errors.push({ id: "section-selfie", message: t.checkin.errors.noSelfie });
    }
    if (getAccuracyStatus() === "blocked") {
      errors.push({ id: "section-location", message: t.checkin.errors.weakGps });
    }
    if (getTimeStatus() === "blocked") {
      errors.push({ id: "section-time", message: t.checkin.errors.windowClosed });
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateAll()) {
      toast.error("Please fix the issues highlighted above.");
      return;
    }

    if (!profile || !position || !blob || !enrollment) return;
    setSubmitState("loading");

    const supabase = createClient();
    try {
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

      setSubmitState("success");
      toast.success(t.checkin.submit.success);
      close(); // shut off camera
    } catch (err: any) {
      setSubmitState("idle");
      toast.error(err.message || t.checkin.errors.submissionFailed);
    }
  };

  if (!isClient) return null;

  if (alreadySubmitted) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center text-center py-24 px-4 max-w-md mx-auto h-full">
        <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mb-6 ring-8 ring-success/5">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold mb-3">{t.checkin.submit.alreadyDone}</h1>
        <p className="text-muted-foreground mb-8 text-lg">{t.checkin.submit.alreadyDoneDesc}</p>
        <StatefulButton 
          label={t.checkin.submit.backToDashboard}
          onClick={() => router.push("/student")} 
        />
      </div>
    );
  }

  if (submitState === "success") {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center text-center py-24 px-4 max-w-md mx-auto h-full">
        <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mb-6 animate-confetti-pop ring-8 ring-success/5">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold mb-3">{t.checkin.submit.success}</h1>
        <p className="text-muted-foreground mb-8 text-lg px-4">{t.checkin.submit.successDesc}</p>
        <StatefulButton 
          label={t.checkin.submit.backToDashboard}
          onClick={() => router.push("/student")} 
        />
      </div>
    );
  }

  // Count met requirements for progress summary
  const requirementsList = [getRadiusStatus(), getSelfieStatus(), getAccuracyStatus(), getTimeStatus()];
  const metCount = requirementsList.filter(s => s === "complete" || s === "warning").length;

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t.checkin.title}</h1>
        <p className="text-muted-foreground mt-1">{t.checkin.subtitle}</p>
      </div>

      {/* Live Readiness Checklist */}
      <div className="card p-5 rounded-2xl space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">
          {interpolate(t.checkin.requirementsMet, { count: metCount, total: 4 })}
        </p>
        <RequirementItem label={t.checkin.requirements.insideArea} status={getRadiusStatus()} detail={distance !== null ? interpolate(t.checkin.location.outsideRadius, { distance: formatDistance(distance) }).split(".")[0] : ""} />
        <RequirementItem label={t.checkin.requirements.selfieCaptured} status={getSelfieStatus()} />
        <RequirementItem label={t.checkin.requirements.gpsAccuracy} status={getAccuracyStatus()} detail={position ? `${formatAccuracy(position.accuracy)}` : ""} />
        <RequirementItem label={t.checkin.requirements.timeWindow} status={getTimeStatus()} />
      </div>

      <ValidationSummary errors={validationErrors} />

      {/* Location Section */}
      <section id="section-location" className="card rounded-2xl overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base">{t.checkin.location.title}</h2>
        </div>
        <div className="p-5 space-y-4">
          {geoError ? (
            <AlertBanner variant="error" title="Location Error" description={geoError === "PERMISSION_DENIED" ? t.checkin.location.permissionDenied : t.checkin.errors.weakGps} action={<button onClick={requestPosition} className="text-sm font-medium underline text-destructive">Try Again</button>} />
          ) : !position ? (
            <div className="py-6 flex flex-col items-center justify-center text-center text-muted-foreground">
               <RefreshCw className="h-6 w-6 animate-spin mb-3 text-primary/50" />
               <p className="text-sm">{t.checkin.location.loading}</p>
            </div>
          ) : (
            <>
              <div className={`rounded-xl p-5 text-center transition-colors border ${withinRadius ? "bg-success/5 border-success/20 text-success" : "bg-destructive/5 border-destructive/20 text-destructive"}`}>
                <p className="text-3xl font-bold tracking-tight">{formatDistance(distance || 0)}</p>
                <p className="text-sm opacity-80 mt-1">{t.checkin.location.fromSchool}</p>
              </div>
              
              <div className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">{t.checkin.location.accuracy}: {formatAccuracy(position.accuracy)}</span>
                <span className="text-muted-foreground">{t.checkin.location.radius}: {school?.radius_m || 200}m</span>
              </div>
              
              <button onClick={requestPosition} disabled={geoLoading} className="w-full py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/80 active:scale-[0.98] transition-all">
                <RefreshCw className={`h-4 w-4 ${geoLoading ? 'animate-spin' : ''}`} />
                {t.checkin.location.refresh}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Selfie Section */}
      <section id="section-selfie" className="card rounded-2xl overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base">{t.checkin.selfie.title}</h2>
        </div>
        <div className="p-5 space-y-4">
          {camError ? (
            <AlertBanner variant="error" title="Camera Error" description={camError} action={<button onClick={open} className="text-sm font-medium underline text-destructive">Try Again</button>} />
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] shadow-inner">
              <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${(!active || preview) ? "hidden" : ""}`} style={{ transform: "scaleX(-1)" }} />
              {preview && <img src={preview} alt="Selfie preview" className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />}
              {!preview && !active && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                  {initializing ? (
                    <>
                      <RefreshCw className="h-10 w-10 mb-3 opacity-50 animate-spin" />
                      <p className="text-sm">Requesting camera permission...</p>
                    </>
                  ) : (
                    <>
                      <Camera className="h-10 w-10 mb-3 opacity-50" />
                      <p className="text-sm">Camera not started yet</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-3">
             {!preview && active ? (
               <StatefulButton label={t.checkin.selfie.take} icon={Camera} onClick={capture} />
             ) : preview ? (
               <>
                 <StatefulButton label={t.checkin.selfie.retake} variant="secondary" onClick={retake} />
               </>
             ) : !camError ? (
               <StatefulButton label={initializing ? "Requesting..." : "Open Camera"} state={initializing ? "loading" : "idle"} icon={Camera} onClick={open} />
             ) : null}
          </div>
        </div>
      </section>

      {/* Time & Reward Section */}
      <section id="section-time" className="card rounded-2xl overflow-hidden">
        <div className="p-4 bg-muted/30 border-b border-border flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-base">{t.checkin.time.title}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{t.checkin.time.window}</span>
            <span className="font-medium">{rewardRules?.attendance_start_time || "--:--"} - {rewardRules?.attendance_end_time || "--:--"}</span>
          </div>
          
          {rewardRules && (
            <AlertBanner 
              variant={isBeforeEarlyCutoff() ? "success" : "info"} 
              title={isBeforeEarlyCutoff() ? "Early Bonus Active!" : t.checkin.time.earlyBonus} 
              description={interpolate(t.checkin.time.earlyBonusDesc, { time: rewardRules.early_cutoff_time, amount: `Rp${rewardRules.early_bonus}` })}
            />
          )}
        </div>
      </section>

      {/* Submit Area */}
      <div className="pt-4 sticky bottom-6 z-20 pb-safe">
        <StatefulButton 
          label={t.checkin.submit.button} 
          loadingLabel={t.checkin.submit.submitting}
          state={submitState}
          icon={Send} 
          onClick={handleSubmit} 
          className="shadow-lg shadow-primary/25"
        />
      </div>
    </div>
  );
}
