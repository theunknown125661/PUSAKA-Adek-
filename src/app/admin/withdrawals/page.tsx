"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Wallet, CheckCircle, XCircle, Loader2, History, Clock } from "lucide-react";
import { toast } from "sonner";

interface PayoutRequestItem {
  id: string;
  user_id: string;
  amount: number;
  destination: string;
  state: string;
  created_at: string;
  full_name: string;
  email: string;
  available_balance: number;
  processed_by_name?: string;
  processed_at?: string;
}

export default function WithdrawalReviewPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [requests, setRequests] = useState<PayoutRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payout_requests")
        .select(`
          id,
          user_id,
          amount,
          destination,
          state,
          created_at,
          processed_at,
          processed_by_profile:profiles!processed_by(full_name),
          profiles:profiles!user_id (
            full_name,
            email,
            wallets (
              balance_available,
              currency_type
            )
          )
        `)
        .in("state", activeTab === "pending" ? ["REQUESTED"] : ["APPROVED", "PAID", "REJECTED"])
        .order("created_at", { ascending: activeTab === "pending" });

      if (error) {
        toast.error("Failed to load requests: " + error.message);
        return;
      }

      const formatted: PayoutRequestItem[] = (data || []).map((req: any) => {
        const rupiahWallet = req.profiles?.wallets?.find((w: any) => w.currency_type === "RUPIAH");
        return {
          id: req.id,
          user_id: req.user_id,
          amount: req.amount,
          destination: req.destination,
          state: req.state,
          created_at: req.created_at,
          full_name: req.profiles?.full_name || "Unknown Student",
          email: req.profiles?.email || "",
          available_balance: rupiahWallet ? rupiahWallet.balance_available : 0,
          processed_by_name: req.processed_by_profile?.full_name,
          processed_at: req.processed_at
        };
      });

      setRequests(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAction = async (reqId: string, action: "APPROVED" | "REJECTED") => {
    setProcessingId(reqId);
    const note = noteMap[reqId] || "";

    try {
      const res = await fetch("/api/admin/process-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: reqId,
          action,
          note
        })
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to process request");
      } else {
        toast.success(`Request successfully ${action.toLowerCase()}`);
        setRequests((prev) => prev.filter((r) => r.id !== reqId));
      }
    } catch (e) {
      toast.error("An unexpected error occurred");
    } finally {
      setProcessingId(null);
    }
  };

  if (!isClient) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-500" /> {t.adminWithdrawals?.title || "Withdrawal Review"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeTab === "pending" 
              ? interpolate(t.adminWithdrawals?.pendingRequests || "Pending requests: {count}", { count: requests.length })
              : `Total processed requests: ${requests.length}`
            }
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-1.5 p-1.5 bg-muted/50 rounded-xl w-fit border border-border/40 shrink-0">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98] ${
              activeTab === "pending"
                ? "bg-background text-foreground shadow-md shadow-black/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Pending
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98] ${
              activeTab === "history"
                ? "bg-background text-foreground shadow-md shadow-black/5"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" /> History
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState 
          icon={Wallet} 
          title={activeTab === "pending" ? (t.adminWithdrawals?.noRequestsTitle || "No Payout Requests") : "No Payout History"} 
          description={activeTab === "pending" ? (t.adminWithdrawals?.noRequestsDesc || "All requests have been reviewed.") : "Processed payout requests will show up here."} 
        />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="glass rounded-2xl p-5 space-y-4 border border-border/40 hover:border-indigo-500/10 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{req.full_name}</p>
                  <p className="text-xs text-muted-foreground">{req.email}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Requested: {formatDate(req.created_at)}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <p className="text-lg font-black text-primary">{formatCurrency(req.amount)}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {req.destination}
                    </span>
                    {activeTab === "history" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        req.state === "REJECTED" 
                          ? "bg-red-500/10 text-red-500" 
                          : "bg-emerald-500/10 text-emerald-500"
                      }`}>
                        {req.state}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {activeTab === "pending" ? (
                <>
                  <div className="text-xs font-semibold text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/40 flex justify-between items-center">
                    <span>{t.adminWithdrawals?.availableBalance || "Student Wallet Balance"}</span>
                    <span className="text-emerald-500 font-bold">{formatCurrency(req.available_balance)}</span>
                  </div>

                  <div className="flex gap-3 items-end pt-1">
                    <input 
                      value={noteMap[req.id] || ""} 
                      onChange={(e) => setNoteMap((prev) => ({ ...prev, [req.id]: e.target.value }))} 
                      placeholder={t.adminWithdrawals?.notePlaceholder || "Add a note (optional)..."} 
                      className="flex-1 px-3 py-2.5 rounded-xl bg-muted/50 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                    />
                    
                    <button 
                      onClick={() => handleAction(req.id, "APPROVED")} 
                      disabled={processingId !== null} 
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/10"
                    >
                      {processingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} 
                      {t.adminWithdrawals?.approve || "Approve"}
                    </button>
                    
                    <button 
                      onClick={() => handleAction(req.id, "REJECTED")} 
                      disabled={processingId !== null} 
                      className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-lg shadow-red-500/10"
                    >
                      <XCircle className="h-3.5 w-3.5" /> 
                      {t.adminWithdrawals?.reject || "Reject"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground bg-muted/20 px-3 py-2 rounded-xl flex flex-wrap justify-between items-center gap-2 border border-border/30">
                  <span>Processed By: <strong className="text-foreground">{req.processed_by_name || "System"}</strong></span>
                  {req.processed_at && <span>Processed At: <strong className="text-foreground">{formatDate(req.processed_at)}</strong></span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
