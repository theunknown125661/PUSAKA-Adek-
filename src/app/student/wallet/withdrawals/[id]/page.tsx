"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { WithdrawalRequest } from "@/lib/types/database";

export default function PayoutPassPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<WithdrawalRequest | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadRequest();
  }, [id]);

  useEffect(() => {
    if (request?.token_expires_at && request.status === "token_issued") {
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(request.token_expires_at!).getTime();
        const distance = expiry - now;

        if (distance < 0) {
          setTimeLeft("Expired");
          clearInterval(interval);
        } else {
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [request]);

  const loadRequest = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      toast.error("Could not load payout request.");
      router.push("/student/wallet");
    } else {
      setRequest(data as WithdrawalRequest);
    }
    setLoading(false);
  };

  const generateToken = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/withdrawals/issue-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success("Payout pass generated!");
      await loadRequest();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate pass");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) return null;

  const isExpired = timeLeft === "Expired" || request.status === "expired";

  return (
    <div className="max-w-md mx-auto p-4 pt-8 space-y-6 animate-fade-in">
      <Link href="/student/wallet" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Wallet
      </Link>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Payout Pass</h1>
        <p className="text-muted-foreground text-sm">Amount: Rp {request.amount.toLocaleString("id-ID")}</p>
      </div>

      <div className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden text-center shadow-lg border border-border/50">
        
        {request.status === "approved" && (
          <div className="space-y-4 py-8">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-bold text-lg">Your Request is Approved!</h3>
            <p className="text-sm text-muted-foreground">Generate your secure one-time payout pass and show it to the admin to receive your cash.</p>
            <button 
              onClick={generateToken}
              disabled={isGenerating}
              className="mt-4 w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Generate Pass"}
            </button>
          </div>
        )}

        {(request.status === "token_issued" || request.status === "expired") && (
          <div className="space-y-6">
            <div className={`p-4 bg-white rounded-2xl inline-block mx-auto ${isExpired ? 'opacity-40 grayscale' : ''}`}>
              <QRCodeSVG 
                value={JSON.stringify({ type: "payout_redeem", request_id: request.id, token: request.token_code })}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manual Code</p>
              <div className={`text-2xl font-black tracking-widest ${isExpired ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                {request.token_code}
              </div>
            </div>

            {isExpired ? (
              <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm font-medium flex flex-col items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                This pass has expired.
                <button 
                  onClick={generateToken}
                  disabled={isGenerating}
                  className="mt-2 w-full bg-destructive text-destructive-foreground font-bold py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate New Pass
                </button>
              </div>
            ) : (
              <div className="bg-secondary text-secondary-foreground rounded-xl p-3 text-sm font-semibold flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" /> Expires in {timeLeft}
              </div>
            )}
            
            <p className="text-[10px] text-muted-foreground pt-4 border-t border-border/50">
              Show this QR code to your school admin to claim your Rp {request.amount.toLocaleString("id-ID")} cash.
            </p>
          </div>
        )}

        {request.status === "redeemed" && (
          <div className="space-y-4 py-8">
            <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-lg text-emerald-500">Payout Redeemed!</h3>
            <p className="text-sm text-muted-foreground">You successfully redeemed your Rp {request.amount.toLocaleString("id-ID")} cash on {new Date(request.redeemed_at!).toLocaleDateString()}.</p>
          </div>
        )}

        {request.status === "rejected" && (
          <div className="space-y-4 py-8 text-destructive">
            <AlertTriangle className="h-12 w-12 mx-auto" />
            <h3 className="font-bold text-lg">Request Rejected</h3>
            <p className="text-sm">Please check with your school admin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
