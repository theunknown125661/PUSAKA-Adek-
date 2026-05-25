"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Loader2, QrCode, Search, AlertTriangle, User as UserIcon, Wallet,
  ClipboardPaste, History, X, Slash
} from "lucide-react";
import { toast } from "sonner";
import type { WithdrawalRequest, Profile } from "@/lib/types/database";

type VerificationState = "idle" | "verifying" | "valid" | "invalid" | "redeemed" | "rejected";

export function RedeemTab() {
  const [manualToken, setManualToken] = useState("");
  const [verificationState, setVerificationState] = useState<VerificationState>("idle");
  const [requestDetails, setRequestDetails] = useState<(WithdrawalRequest & { profiles?: Profile }) | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [scanMethod, setScanMethod] = useState<"qr" | "manual">("qr");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState("");

  const [stats, setStats] = useState({ pending: 0, redeemedToday: 0, expired: 0, failed: 0 });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();

    // Initialize QR Scanner with Core API for seamless UI
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        try {
          const payload = JSON.parse(decodedText);
          if (payload.token) {
            verifyToken(payload.token, "qr");
            scanner.pause(true);
          }
        } catch (e) {
          if (decodedText.startsWith("PAY-")) {
            verifyToken(decodedText, "qr");
            scanner.pause(true);
          }
        }
      },
      () => {
        // Ignore routine scan errors
      }
    ).catch(err => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setCameraError("Camera requires HTTPS. Access via localhost or a secure tunnel (e.g., ngrok) on mobile.");
      } else {
        setCameraError(typeof err === 'string' ? err : "Camera permission denied or unavailable.");
      }
      console.error("QR Start Error:", err);
    });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(console.error);
      } else {
        scanner.clear();
      }
    };
  }, []);

  const loadDashboardData = async () => {
    const supabase = createClient();
    
    // Get pending count
    const { count: pendingCount } = await supabase
      .from("withdrawal_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "token_issued");

    // Get today's logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: logsData } = await supabase
      .from("payout_redemption_logs")
      .select("result")
      .gte("created_at", today.toISOString());

    let redeemed = 0;
    let expired = 0;
    let failed = 0;

    logsData?.forEach(log => {
      if (log.result === "success") redeemed++;
      else if (log.result === "expired") expired++;
      else failed++;
    });

    setStats({
      pending: pendingCount || 0,
      redeemedToday: redeemed,
      expired: expired,
      failed: failed
    });

    // Recent Activity Table
    const { data: recent } = await supabase
      .from("payout_redemption_logs")
      .select("*, profiles!student_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(5);
      
    if (recent) setRecentLogs(recent);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setManualToken(text.toUpperCase());
    } catch (err) {
      toast.error("Failed to read clipboard");
    }
  };

  const verifyToken = async (tokenString: string, method: "qr" | "manual" = "manual") => {
    const cleanToken = tokenString.trim().toUpperCase();
    if (!cleanToken) return;
    
    setScanMethod(method);
    setVerificationState("verifying");
    setErrorMsg("");
    
    const supabase = createClient();
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*, profiles!student_id(*)")
      .eq("token_code", cleanToken)
      .single();

    if (error || !data) {
      setVerificationState("invalid");
      setErrorMsg("Token not found or invalid.");
      // Log attempt asynchronously
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
         await supabase.from("payout_redemption_logs").insert({
           student_id: userData.user.id, // Using self as placeholder if unknown student
           admin_id: userData.user.id,
           attempt_type: method,
           token_entered: cleanToken,
           result: "invalid"
         });
         loadDashboardData();
      }
      return;
    }

    setRequestDetails(data as any);

    if (data.status === "redeemed") {
      setVerificationState("invalid");
      setErrorMsg("This payout pass has already been redeemed.");
    } else if (data.status === "expired" || (data.token_expires_at && new Date(data.token_expires_at) < new Date())) {
      setVerificationState("invalid");
      setErrorMsg("This payout pass has expired.");
    } else if (data.status === "rejected" || data.status === "cancelled") {
      setVerificationState("invalid");
      setErrorMsg(`Request was ${data.status}. Not eligible for redemption.`);
    } else if (data.status !== "token_issued") {
      setVerificationState("invalid");
      setErrorMsg("Withdrawal request is not ready for redemption.");
    } else {
      setVerificationState("valid");
    }
  };

  const executeRedemption = async () => {
    if (!requestDetails) return;
    
    // Inline Confirmation Step
    if (!window.confirm(`Confirm payout of Rp ${requestDetails.amount.toLocaleString("id-ID")} to ${requestDetails.profiles?.full_name}?`)) {
      return;
    }

    setIsRedeeming(true);

    try {
      const res = await fetch("/api/admin/withdrawals/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: requestDetails.token_code, method: scanMethod })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVerificationState("redeemed");
      toast.success("Payout confirmed and funds deducted!");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to redeem payout");
      setVerificationState("invalid");
      setErrorMsg(err.message || "Redemption failed");
    } finally {
      setIsRedeeming(false);
    }
  };

  const executeRejection = async () => {
    if (!requestDetails || !rejectReason.trim()) return;
    
    setIsRejecting(true);

    try {
      const res = await fetch("/api/admin/withdrawals/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token: requestDetails.token_code, 
          method: scanMethod,
          reason: rejectReason 
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVerificationState("rejected");
      setShowRejectModal(false);
      setRejectReason("");
      toast.success("Payout request rejected.");
      loadDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject payout");
    } finally {
      setIsRejecting(false);
    }
  };

  const resetScanner = () => {
    setVerificationState("idle");
    setManualToken("");
    setRequestDetails(null);
    setErrorMsg("");
    if (scannerRef.current && scannerRef.current.getState() === 3) {
      // 3 means PAUSED in Html5Qrcode core state. Unpause it.
      scannerRef.current.resume();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Bar Stats */}
      <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
        <div className="bg-muted/50 border border-border rounded-xl p-3 min-w-[120px]">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Pending Passes</p>
          <p className="text-2xl font-black text-amber-500">{stats.pending}</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-3 min-w-[120px]">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Redeemed Today</p>
          <p className="text-2xl font-black text-emerald-500">{stats.redeemedToday}</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-3 min-w-[120px]">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Failed Attempts</p>
          <p className="text-2xl font-black text-rose-500">{stats.failed}</p>
        </div>
      </div>

      {/* Main Content - 2 Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* LEFT COLUMN: Validation Panel (40%) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Scanner Card */}
          <div className="relative w-full aspect-[4/5] md:aspect-square rounded-3xl overflow-hidden bg-black/5 dark:bg-white/5 border border-border shadow-xl flex items-center justify-center group transition-all duration-300">
            {cameraError ? (
              <div className="text-center p-6 flex flex-col items-center">
                <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
                <p className="font-bold text-foreground">Camera Unavailable</p>
                <p className="text-sm text-muted-foreground mt-1">{cameraError}</p>
                <p className="text-xs text-muted-foreground mt-4">Please use manual token entry below.</p>
              </div>
            ) : (
              <>
                {/* The scanner viewport */}
                <div id="qr-reader" className="absolute inset-0 w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&_video]:absolute [&_video]:inset-0"></div>
                
                {/* White Hint Pill */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 bg-white/95 backdrop-blur-md text-slate-800 font-semibold text-[13px] rounded-full shadow-xl pointer-events-none whitespace-nowrap">
                  Align QR code within frame
                </div>
              </>
            )}
          </div>

          {/* Manual Entry Card */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="font-bold flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                Enter token manually
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="PAY-XXXX-XXXX"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value.toUpperCase())}
                    className="w-full pl-4 pr-10 py-3 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 uppercase tracking-widest font-mono text-sm font-bold"
                  />
                  <button 
                    onClick={handlePaste}
                    title="Paste from clipboard"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                  </button>
                </div>
                <button 
                  onClick={() => verifyToken(manualToken, "manual")}
                  disabled={!manualToken || verificationState === "verifying"}
                  className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50 active:scale-95 transition-all shadow-sm"
                >
                  Verify
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Use this if the QR code can't be scanned or camera is unavailable.</p>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Request Detail Panel (60%) */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-3xl shadow-sm h-full flex flex-col relative overflow-hidden">
            
            {/* Overlay for Idle/Verifying states */}
            {(verificationState === "idle" || verificationState === "verifying") && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-muted-foreground">
                {verificationState === "idle" ? (
                  <>
                    <QrCode className="h-16 w-16 mb-4 opacity-20" />
                    <p className="font-medium text-lg">Waiting for scan...</p>
                    <p className="text-sm opacity-60">Scan a token to view request details.</p>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                    <p className="font-bold text-lg animate-pulse">Verifying Token...</p>
                  </>
                )}
              </div>
            )}

            {/* Header / Validation Result */}
            <div className={`p-6 border-b flex items-start justify-between transition-colors ${
              verificationState === "valid" ? "bg-emerald-500/10 border-emerald-500/20" :
              verificationState === "invalid" ? "bg-rose-500/10 border-rose-500/20" :
              verificationState === "redeemed" ? "bg-blue-500/10 border-blue-500/20" :
              verificationState === "rejected" ? "bg-muted border-border" : "border-border"
            }`}>
              <div>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Validation Result</h2>
                {verificationState === "valid" && <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">Valid Payout Request</h3>}
                {verificationState === "invalid" && <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">{errorMsg || "Invalid Token"}</h3>}
                {verificationState === "redeemed" && <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">Successfully Redeemed</h3>}
                {verificationState === "rejected" && <h3 className="text-2xl font-black text-muted-foreground">Request Rejected</h3>}
              </div>
              
              {verificationState !== "idle" && verificationState !== "verifying" && (
                <button onClick={resetScanner} className="p-2 bg-background hover:bg-muted border border-border rounded-xl transition-colors">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Details Panel */}
            <div className={`p-6 flex-1 space-y-8 ${!requestDetails ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}>
              
              {/* Student Block */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-muted rounded-2xl overflow-hidden flex items-center justify-center border border-border/50">
                  {requestDetails?.profiles?.avatar_url ? (
                    <img src={requestDetails.profiles.avatar_url} className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h4 className="text-xl font-black">{requestDetails?.profiles?.full_name || "Unknown Student"}</h4>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded-md font-mono">{requestDetails?.student_id.substring(0,8)}</span>
                  </div>
                </div>
              </div>

              {/* Payout Block */}
              <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Requested Amount</p>
                  <p className="text-4xl font-black text-foreground">Rp {requestDetails?.amount?.toLocaleString("id-ID") || 0}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground">Status</span>
                    <span className="text-xs font-bold px-2 py-1 bg-background rounded-md border border-border uppercase tracking-wider">{requestDetails?.status}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted-foreground">Expires</span>
                    <span className="text-xs font-bold text-foreground">
                      {requestDetails?.token_expires_at ? new Date(requestDetails.token_expires_at).toLocaleString() : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Notes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Security Audit</h4>
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-2xl text-sm font-medium">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div>
                    <p>Method: {scanMethod === 'qr' ? 'QR Code Scan' : 'Manual Entry'}</p>
                    <p className="text-xs opacity-80 mt-1">Ensure the student identity matches the profile picture above before confirming.</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Action Footer */}
            <div className={`p-6 border-t border-border bg-muted/10 grid grid-cols-2 gap-4 transition-opacity duration-300 ${verificationState === 'valid' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <button 
                onClick={() => setShowRejectModal(true)}
                className="py-4 bg-background border border-border hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-500 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Slash className="h-5 w-5" /> Reject Redemption
              </button>
              <button 
                onClick={executeRedemption}
                disabled={isRedeeming}
                className="py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isRedeeming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                {isRedeeming ? "Processing..." : "Confirm Payout"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" /> Recent Redemption Activity</h3>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground text-xs uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium">{new Date(log.created_at).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 font-semibold">{log.profiles?.full_name || "Unknown"}</td>
                    <td className="px-6 py-4 text-muted-foreground uppercase text-xs">{log.attempt_type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        log.result === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                        log.result === 'invalid' ? 'bg-rose-500/10 text-rose-500' :
                        log.result === 'forbidden' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No recent activity found today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-rose-500 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6" /> Reject Payout
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="p-1.5 hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this payout. This action will be logged and the student will be notified.
            </p>
            
            <textarea
              placeholder="e.g. Identity does not match profile picture, suspicious behavior..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full min-h-[100px] p-4 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none text-sm"
            />
            
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="px-5 py-2 font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeRejection}
                disabled={!rejectReason.trim() || isRejecting}
                className="px-5 py-2 bg-rose-500 text-white font-bold rounded-xl disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
              >
                {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
