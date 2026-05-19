"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Wallet, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { WithdrawalRequest } from "@/lib/types/database";

export default function WithdrawalReviewPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("*, profiles(full_name, email), wallets(available_balance)")
        .eq("status", "pending")
        .order("requested_at", { ascending: true });
      setRequests((data || []) as unknown as WithdrawalRequest[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleAction = async (reqId: string, action: "approved" | "rejected") => {
    setProcessingId(reqId);
    const supabase = createClient();
    const note = noteMap[reqId] || "";

    await supabase.from("withdrawal_requests").update({
      status: action,
      admin_note: note || null,
      processed_at: new Date().toISOString(),
    }).eq("id", reqId);

    if (action === "approved") {
      const req = requests.find((r) => r.id === reqId);
      if (req) {
        await supabase.rpc("process_withdrawal", { p_wallet_id: req.wallet_id, p_amount: req.amount });
      }
    }

    setRequests((prev) => prev.filter((r) => r.id !== reqId));
    setProcessingId(null);
  };

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Wallet className="h-5 w-5" /> {t.adminWithdrawals.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{interpolate(t.adminWithdrawals.pendingRequests, { count: requests.length })}</p>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={Wallet} title={t.adminWithdrawals.noRequestsTitle} description={t.adminWithdrawals.noRequestsDesc} />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{(req.profiles as unknown as { full_name: string })?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(req.requested_at)}</p>
                </div>
                <p className="text-lg font-bold">{formatCurrency(req.amount)}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {t.adminWithdrawals.availableBalance}: {formatCurrency((req.wallets as unknown as { available_balance: number })?.available_balance || 0)}
              </div>
              <div className="flex gap-2 items-end">
                <input 
                  value={noteMap[req.id] || ""} 
                  onChange={(e) => setNoteMap((prev) => ({ ...prev, [req.id]: e.target.value }))} 
                  placeholder={t.adminWithdrawals.notePlaceholder} 
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50" 
                />
                <button 
                  onClick={() => handleAction(req.id, "approved")} 
                  disabled={processingId === req.id} 
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                >
                  {processingId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} {t.adminWithdrawals.approve}
                </button>
                <button 
                  onClick={() => handleAction(req.id, "rejected")} 
                  disabled={processingId === req.id} 
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> {t.adminWithdrawals.reject}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
