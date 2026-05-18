"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Lock, Clock, Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatefulButton, type ButtonState } from "@/components/ui/stateful-button";
import { toast } from "sonner";
import type { Wallet as WalletType, WalletTransaction, WithdrawalRequest } from "@/lib/types/database";

type Tab = "transactions" | "withdraw";

export default function WalletPage() {
  const { profile } = useUserRole();
  const { t, interpolate, isClient } = useTranslation();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawState, setWithdrawState] = useState<ButtonState>("idle");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    async function loadData() {
      const [walletRes, txRes, wdRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("student_id", profile!.id).single(),
        supabase.from("wallet_transactions").select("*").eq("wallet_id", profile!.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("withdrawal_requests").select("*").eq("student_id", profile!.id).order("requested_at", { ascending: false }).limit(10),
      ]);
      
      if (walletRes.data) setWallet(walletRes.data);
      if (txRes.data) setTransactions(txRes.data as WalletTransaction[]);
      if (wdRes.data) setWithdrawals(wdRes.data as WithdrawalRequest[]);
      
      // Calculate blocked reason for withdrawal
      const lastWd = wdRes.data?.[0] as WithdrawalRequest;
      const avBal = walletRes.data?.available_balance || 0;
      
      if (avBal < 10000) {
        setBlockedReason(interpolate(t.wallet.minAmount, { min: formatCurrency(10000), current: formatCurrency(avBal) }));
      } else if (lastWd && lastWd.status !== 'rejected') {
        const daysSinceWd = (new Date().getTime() - new Date(lastWd.requested_at).getTime()) / (1000 * 3600 * 24);
        if (daysSinceWd < 7) {
          setBlockedReason(interpolate(t.wallet.cooldown, { days: Math.ceil(7 - daysSinceWd) }));
        }
      }
      
      setLoading(false);
    }
    loadData();
  }, [profile, t]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockedReason) return;
    
    const amount = parseInt(withdrawAmount.replace(/\D/g, ""));
    if (isNaN(amount) || amount <= 0) {
      toast.error(t.wallet.enterAmount);
      return;
    }
    
    if (wallet && amount > wallet.available_balance) {
      toast.error(t.wallet.insufficientBalance);
      return;
    }

    setWithdrawState("loading");
    const supabase = createClient();
    try {
      const { error } = await supabase.from("withdrawal_requests").insert({
        student_id: profile!.id,
        amount,
        status: "pending",
      });
      if (error) throw error;
      
      setWithdrawState("success");
      toast.success(t.wallet.requestSuccess);
      setWithdrawAmount("");
      
      // Reload data after a short delay
      setTimeout(() => {
        setWithdrawState("idle");
        setActiveTab("transactions");
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setWithdrawState("error");
      toast.error(err.message || "Failed to submit request.");
      setTimeout(() => setWithdrawState("idle"), 3000);
    }
  };

  if (!isClient || loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const isBlocked = !!blockedReason;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold">{t.wallet.title}</h1>
      </div>

      {/* Hero Balance Card */}
      <div className="card rounded-3xl overflow-hidden shadow-lg shadow-success/10 bg-gradient-to-br from-success/5 via-success/10 to-transparent border-success/20">
        <div className="p-6 pb-5 border-b border-success/10">
          <p className="text-sm font-semibold text-success uppercase tracking-wider mb-2">{t.dashboard.available}</p>
          <div className="flex items-baseline gap-1.5">
            <h2 className="text-4xl font-extrabold text-foreground tracking-tight">{formatCurrency(wallet?.available_balance || 0)}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t.wallet.availableHelp}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border bg-card/50">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{t.dashboard.pending}</p>
              <p className="font-semibold text-warning">{formatCurrency(wallet?.pending_balance || 0)}</p>
            </div>
            <Clock className="h-4 w-4 text-warning/50" />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{t.dashboard.held}</p>
              <p className="font-semibold text-info">{formatCurrency(wallet?.held_balance || 0)}</p>
            </div>
            <Lock className="h-4 w-4 text-info/50" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-muted p-1 rounded-xl flex">
        <button onClick={() => setActiveTab("transactions")} className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all ${activeTab === "transactions" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {t.wallet.transactions}
        </button>
        <button onClick={() => setActiveTab("withdraw")} className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all ${activeTab === "withdraw" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {t.wallet.withdrawTab}
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-slide-up">
        {activeTab === "transactions" ? (
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <EmptyState 
                icon={WalletIcon} 
                title={t.wallet.noTransactions} 
                description={t.wallet.noTransactionsDesc} 
              />
            ) : (
              <div className="card rounded-2xl overflow-hidden divide-y divide-border">
                {transactions.map((tx) => {
                  const isNegative = tx.type === 'withdrawal' || tx.type === 'hold_lock';
                  return (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${!isNegative ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {!isNegative ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm capitalize">{tx.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${!isNegative ? 'text-success' : 'text-foreground'}`}>
                        {!isNegative ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleWithdraw} className="card rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="font-semibold mb-1">{t.wallet.requestWithdrawal}</h3>
                <p className="text-sm text-muted-foreground">{t.wallet.minWeekly}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t.wallet.enterAmount}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-muted-foreground font-semibold">Rp</span>
                  </div>
                  <input
                    type="text"
                    value={withdrawAmount}
                    onChange={(e) => {
                       const val = e.target.value.replace(/\D/g, "");
                       setWithdrawAmount(val ? parseInt(val).toLocaleString("id-ID") : "");
                    }}
                    disabled={isBlocked || withdrawState === "loading" || withdrawState === "success"}
                    placeholder="50.000"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted/50 border-none font-bold text-lg focus:ring-2 focus:ring-primary focus:bg-background transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <StatefulButton 
                type="submit"
                label={t.wallet.requestButton}
                loadingLabel={t.wallet.requesting}
                icon={ArrowUpRight}
                state={isBlocked ? "blocked" : withdrawState}
                blockedReason={blockedReason || undefined}
                className="w-full"
              />
            </form>

            {withdrawals.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm px-1">{t.wallet.withdrawalHistory}</h3>
                <div className="card rounded-2xl overflow-hidden divide-y divide-border">
                  {withdrawals.map((wd) => (
                    <div key={wd.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-semibold text-sm">{formatCurrency(wd.amount)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(wd.requested_at)}</p>
                      </div>
                      <StatusBadge status={wd.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
