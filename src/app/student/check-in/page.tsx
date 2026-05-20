"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { useCamera } from "@/lib/hooks/use-camera";
import { useTranslation } from "@/lib/i18n/use-translation";
import { haversineDistance } from "@/lib/utils/haversine";
import { formatDistance, formatAccuracy, formatCurrency } from "@/lib/utils/format";
import { detectFraudFlags } from "@/lib/utils/fraud-flags";

import { MapPin, Camera, Clock, Gift, RefreshCw, Send, CheckCircle2, GraduationCap, ChevronRight, ChevronLeft, ShieldAlert, Sparkles, Award } from "lucide-react";
import { StatefulButton, type ButtonState } from "@/components/ui/stateful-button";
import { RequirementItem, type RequirementStatus } from "@/components/ui/requirement-item";
import { ValidationSummary, type ValidationError } from "@/components/ui/validation-summary";
import { AlertBanner } from "@/components/ui/alert-banner";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const CheckInMap = dynamic(() => import("@/components/student/check-in-map"), { ssr: false });

export default function CheckInPage() {
  const { profile } = useUserRole();
  const { t, interpolate, isClient } = useTranslation();
  const { position, error: geoError, loading: geoLoading, requestPosition } = useGeolocation();
  const { videoRef, preview, blob, active, initializing, error: camError, open, capture, retake, close } = useCamera();
  const router = useRouter();

  const [school, setSchool] = useState<{ latitude: number; longitude: number; radius_m: number; accuracy_tolerance_m?: number } | null>(null);
  const [enrollment, setEnrollment] = useState<{ class_id: string; school_id: string } | null>(null);
  const [rewardRules, setRewardRules] = useState<{ attendance_start_time: string; attendance_end_time: string; early_cutoff_time: string; base_reward: number; early_bonus: number } | null>(null);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [withinRadius, setWithinRadius] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  
  const [submitState, setSubmitState] = useState<ButtonState>("idle");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [noEnrollment, setNoEnrollment] = useState(false);

  // Stepper state
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    async function loadMeta() {
      const { data: enr } = await supabase.from("enrollments").select("class_id, classes(school_id)").eq("student_id", profile!.id).limit(1).maybeSingle();
      if (!enr) {
        setNoEnrollment(true);
        return;
      }
      const schoolId = (enr.classes as unknown as { school_id: string })?.school_id;
      setEnrollment({ class_id: enr.class_id, school_id: schoolId });

      const [schoolRes, rulesRes, todayRes] = await Promise.all([
        supabase.from("schools").select("latitude, longitude, radius_m, accuracy_tolerance_m").eq("id", schoolId).single(),
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
    // Auto request position if we don't have it yet
    if (isClient && !position && !geoLoading && !geoError) {
       requestPosition();
    }
  }, [isClient, position, geoLoading, geoError]);

  useEffect(() => {
    // Open camera when entering step 2
    if (isClient && step === 2 && !active && !preview) {
      open();
    }
    // Close camera when leaving step 2
    if (isClient && step !== 2 && active) {
      close();
    }
  }, [isClient, step, active, preview]);

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
    const tol = school?.accuracy_tolerance_m || 100;
    if (position.accuracy > tol) return "blocked";
    if (position.accuracy > (tol / 2)) return "warning";
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
      toast.error("Please fix the issues highlighted in the summary.");
      return;
    }

    if (!profile || !position || !blob || !enrollment) return;
    setSubmitState("loading");

    const supabase = createClient();
    try {
      const fileName = `${profile.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("attendance-selfies").upload(fileName, blob, { contentType: "image/jpeg" });
      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        throw new Error("Selfie upload failed: " + uploadErr.message);
      }

      const { data: urlData } = supabase.storage.from("attendance-selfies").getPublicUrl(fileName);
      const flags = detectFraudFlags({
        distanceM: distance || 0,
        radiusM: school?.radius_m || 200,
        accuracyM: position.accuracy,
        accuracyToleranceM: school?.accuracy_tolerance_m || 100,
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
      if (insertErr) {
        console.error("Insert error:", JSON.stringify(insertErr, null, 2), insertErr);
        throw new Error("Database insert failed: " + (insertErr.message || JSON.stringify(insertErr)));
      }

      // Check off quests progress asynchronously on database side
      setSubmitState("success");
      toast.success(t.checkin.submit.success);
      close();
    } catch (err: any) {
      setSubmitState("idle");
      toast.error(err.message || t.checkin.errors.submissionFailed);
    }
  };

  if (!isClient) return null;

  if (noEnrollment) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center text-center py-20 px-4 max-w-md mx-auto">
        <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 ring-8 ring-amber-500/5">
          <GraduationCap className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Join a Class First</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          You are not enrolled in any class yet. You must select a school and class before you can submit attendance.
        </p>
        <StatefulButton 
          label="Choose Class"
          onClick={() => router.push("/student/class")} 
        />
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center text-center py-24 px-4 max-w-md mx-auto h-full">
        <div className="h-20 w-20 rounded-full bg-success/20 flex items-center justify-center mb-6 ring-8 ring-success/5 animate-pulse">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-black mb-3">{t.checkin.submit.alreadyDone}</h1>
        <p className="text-muted-foreground mb-8 text-sm">{t.checkin.submit.alreadyDoneDesc}</p>
        <button 
          onClick={() => router.push("/student")}
          className="btn btn-primary w-full py-3.5 rounded-2xl font-bold text-sm shadow-md"
        >
          {t.checkin.submit.backToDashboard}
        </button>
      </div>
    );
  }

  if (submitState === "success") {
    // Confetti success rewards view
    const isEarly = isBeforeEarlyCutoff();
    const baseVal = rewardRules?.base_reward || 5000;
    const bonusVal = rewardRules?.early_bonus || 2000;
    const totalAward = baseVal + (isEarly ? bonusVal : 0);

    return (
      <div className="animate-fade-in flex flex-col items-center justify-center text-center py-12 px-5 max-w-md mx-auto space-y-6">
        <div className="relative">
          <span className="absolute inset-0 bg-success/20 blur-xl rounded-full scale-150 animate-pulse" />
          <div className="h-24 w-24 rounded-full bg-emerald-500 text-white flex items-center justify-center relative shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-12 w-12" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">{t.checkin.submit.success}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed px-4">{t.checkin.submit.successDesc}</p>
        </div>

        {/* Celebration reward summary banner */}
        <div className="w-full bg-gradient-to-br from-amber-500/10 to-orange-600/10 border-2 border-amber-500/20 rounded-[32px] p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-500">
            <Sparkles className="h-5 w-5 animate-spin duration-3000" />
            <span className="text-xs uppercase tracking-wider font-black">Daily Check-in Rewards</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border/40 p-4 rounded-2xl flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white font-bold text-xs shadow-sm mb-1.5">$</div>
              <span className="text-lg font-black text-amber-500">+20 Coins</span>
            </div>
            <div className="bg-card border border-border/40 p-4 rounded-2xl flex flex-col items-center">
              <div className="h-8 w-8 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-1.5">
                <Award className="h-4.5 w-4.5" />
              </div>
              <span className="text-lg font-black text-indigo-500">+50 XP</span>
            </div>
          </div>

          {rewardRules && (
            <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold p-2.5 rounded-xl border border-emerald-500/20">
              Rupiah wallet pending reward: +{formatCurrency(totalAward)} {isEarly && "⚡ (Includes Early Bird Bonus)"}
            </div>
          )}
        </div>

        <button 
          onClick={() => {
            router.push("/student");
          }} 
          className="btn btn-primary w-full py-4 rounded-2xl font-bold text-sm shadow-lg shadow-primary/25"
        >
          {t.checkin.submit.backToDashboard}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto pb-12">
      {/* Header & Steps Indicator */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-black">{t.checkin.title}</h1>
          <p className="text-muted-foreground text-xs mt-1">{t.checkin.subtitle}</p>
        </div>

        {/* Fancy Progress Stepper bar */}
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex flex-col gap-1.5">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  s < step ? "bg-primary" : s === step ? "bg-primary shadow-sm" : "bg-muted"
                }`}
              />
              <span className={`text-[10px] font-bold text-center capitalize ${s === step ? "text-primary font-black" : "text-muted-foreground"}`}>
                {s === 1 ? "Location" : s === 2 ? "Selfie" : "Submit"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stepper Content Panel */}
      <div className="card rounded-[28px] overflow-hidden p-6 space-y-6">
        
        {/* STEP 1: Location Verification */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Verify Your Location</h3>
                <p className="text-xs text-muted-foreground">Make sure you are within your school radius boundary</p>
              </div>
            </div>

            {geoError ? (
              <AlertBanner 
                variant="error" 
                title="Location Error" 
                description={geoError === "PERMISSION_DENIED" ? t.checkin.location.permissionDenied : t.checkin.errors.weakGps} 
                action={<button onClick={requestPosition} className="text-xs font-bold underline text-destructive">Retry GPS</button>} 
              />
            ) : !position ? (
              <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mb-3 text-primary/50" />
                <p className="text-sm font-semibold">{t.checkin.location.loading}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {school && (
                  <div className="rounded-2xl overflow-hidden border border-border/50">
                    <CheckInMap
                      studentLat={position.latitude}
                      studentLng={position.longitude}
                      accuracy={position.accuracy}
                      schoolLat={school.latitude}
                      schoolLng={school.longitude}
                      schoolRadius={school.radius_m}
                      withinRadius={withinRadius}
                    />
                  </div>
                )}

                <div className={`rounded-2xl p-5 text-center border transition-all ${
                  withinRadius 
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                    : "bg-destructive/5 border-destructive/20 text-destructive"
                }`}>
                  <p className="text-4xl font-black tracking-tight">{formatDistance(distance || 0)}</p>
                  <p className="text-xs opacity-90 mt-1">{t.checkin.location.fromSchool}</p>
                  <p className="text-[10px] font-bold mt-2 uppercase tracking-wide">
                    {withinRadius ? "Within range limit" : "Outside school boundary"}
                  </p>
                </div>
                
                <div className="flex items-center justify-between text-xs px-1 text-muted-foreground font-semibold">
                  <span>GPS accuracy: {formatAccuracy(position.accuracy)}</span>
                  <span>School boundary radius: {school?.radius_m || 200}m</span>
                </div>
                
                <button 
                  onClick={requestPosition} 
                  disabled={geoLoading} 
                  className="w-full py-3 rounded-xl bg-muted text-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-muted/80 active:scale-[0.98] transition-all"
                >
                  <RefreshCw className={`h-4 w-4 ${geoLoading ? 'animate-spin' : ''}`} />
                  Refresh GPS Coordinates
                </button>
              </div>
            )}

            {/* Stepper Navigation buttons */}
            <div className="pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!position}
                className="w-full py-4.5 rounded-2xl bg-primary text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed to Selfie
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Selfie Capture */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">{t.checkin.selfie.title}</h3>
                <p className="text-xs text-muted-foreground">Capture a selfie photo inside the classroom as attendance proof</p>
              </div>
            </div>

            {camError ? (
              <AlertBanner 
                variant="error" 
                title="Camera Error" 
                description={camError} 
                action={<button onClick={open} className="text-xs font-bold underline text-destructive">Retry Camera</button>} 
              />
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] shadow-inner border border-border/50">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`absolute inset-0 w-full h-full object-cover ${(!active || preview) ? "hidden" : ""}`} 
                    style={{ transform: "scaleX(-1)" }} 
                  />
                  {preview && (
                    <img 
                      src={preview} 
                      alt="Selfie preview" 
                      className="absolute inset-0 w-full h-full object-cover" 
                      style={{ transform: "scaleX(-1)" }} 
                    />
                  )}
                  {!preview && !active && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                      {initializing ? (
                        <>
                          <RefreshCw className="h-10 w-10 mb-3 opacity-50 animate-spin" />
                          <p className="text-sm font-semibold">Opening camera lens...</p>
                        </>
                      ) : (
                        <>
                          <Camera className="h-10 w-10 mb-3 opacity-50" />
                          <p className="text-sm font-semibold">Camera is stopped</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {!preview && active ? (
                    <button 
                      onClick={capture} 
                      className="w-full py-4 rounded-xl bg-primary text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      <Camera className="h-5 w-5" />
                      Take Snapshot
                    </button>
                  ) : preview ? (
                    <button 
                      onClick={retake} 
                      className="w-full py-4 rounded-xl bg-muted text-foreground font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-muted/80 active:scale-[0.98] transition-all"
                    >
                      <RefreshCw className="h-4.5 w-4.5" />
                      Retake Photo
                    </button>
                  ) : !camError ? (
                    <button 
                      onClick={open} 
                      disabled={initializing}
                      className="w-full py-4 rounded-xl bg-primary text-white font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <Camera className="h-5 w-5" />
                      {initializing ? "Requesting..." : "Start Camera"}
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {/* Stepper Navigation buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 rounded-2xl bg-muted text-foreground font-extrabold text-sm flex items-center justify-center gap-1.5 hover:bg-muted/80 active:scale-[0.97] transition-all"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!preview}
                className="flex-1 py-4 rounded-2xl bg-primary text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Verification Review & Submission */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Submit Attendance</h3>
                <p className="text-xs text-muted-foreground">Verify all checks below before locking in your attendance log</p>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="space-y-2 border border-border/40 p-4.5 rounded-2xl bg-muted/20">
              <RequirementItem label={t.checkin.requirements.insideArea} status={getRadiusStatus()} detail={distance !== null ? `${formatDistance(distance)} from school` : ""} />
              <RequirementItem label={t.checkin.requirements.selfieCaptured} status={getSelfieStatus()} />
              <RequirementItem label={t.checkin.requirements.gpsAccuracy} status={getAccuracyStatus()} detail={position ? `Accuracy: ${formatAccuracy(position.accuracy)}` : ""} />
              <RequirementItem label={t.checkin.requirements.timeWindow} status={getTimeStatus()} />
            </div>

            {validationErrors.length > 0 && (
              <ValidationSummary errors={validationErrors} />
            )}

            {/* Selfie Review thumbnail */}
            {preview && (
              <div className="flex items-center gap-4 bg-muted/10 p-3 rounded-2xl border border-border/40">
                <div className="h-16 w-16 rounded-xl overflow-hidden shrink-0 border border-border bg-black">
                  <img src={preview} alt="Captured Selfie" className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                </div>
                <div>
                  <p className="text-xs font-extrabold">Photo Proof Ready</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Selfie captured inside class boundaries</p>
                </div>
              </div>
            )}

            {rewardRules && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-2xl text-xs space-y-1 font-semibold">
                <p className="font-extrabold text-sm flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                  <Gift className="h-4.5 w-4.5" /> Rewards Awaiting:
                </p>
                <div className="flex justify-between">
                  <span>Base reward:</span>
                  <span>+{formatCurrency(rewardRules.base_reward)} Rupiah</span>
                </div>
                {isBeforeEarlyCutoff() && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Early bird bonus active:</span>
                    <span>+{formatCurrency(rewardRules.early_bonus)} Rupiah</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-emerald-500/20 pt-1.5 mt-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
                  <span>Submitting gives:</span>
                  <span>+20 Coins & +50 XP</span>
                </div>
              </div>
            )}

            {/* Stepper Navigation buttons */}
            <div className="flex flex-col gap-3.5 pt-2">
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 rounded-2xl bg-muted text-foreground font-extrabold text-sm flex items-center justify-center gap-1.5 hover:bg-muted/80 active:scale-[0.97] transition-all"
                >
                  <ChevronLeft className="h-4.5 w-4.5" />
                  Back to Selfie
                </button>
              </div>

              <StatefulButton 
                label={t.checkin.submit.button} 
                loadingLabel={t.checkin.submit.submitting}
                state={submitState}
                icon={Send} 
                onClick={handleSubmit} 
                className="w-full py-4.5 rounded-2xl font-black text-sm shadow-xl shadow-primary/25"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
