"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Wallet as WalletIcon, Lock, Clock, Coins, Loader2, Award, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import AvatarDisplay from "@/components/profile/avatar-display";
import { NotificationBell } from "@/components/shared/notification-bell";
import Link from "next/link";

type Wallet = {
  id: string;
  currency_type: "COIN" | "RUPIAH";
  balance_available: number;
  balance_pending: number;
  balance_locked: number;
};

type Transaction = {
  id: string;
  event_type: string;
  amount: number;
  currency_type: "COIN" | "RUPIAH";
  state: string;
  note: string;
  created_at: string;
};

type PayoutRequest = {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
};

export default function WalletPage() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [txCurrencyFilter, setTxCurrencyFilter] = useState<"ALL" | "COIN" | "RUPIAH">("ALL");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);

  const fetchWalletData = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    
    try {
      const [walletsRes, txRes, requestsRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("user_id", profile.id),
        supabase.from("wallet_transactions").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("withdrawal_requests").select("*").eq("student_id", profile.id).order("requested_at", { ascending: false }).limit(15)
      ]);
      
      if (walletsRes.data) setWallets(walletsRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (requestsRes.data) setPayoutRequests(requestsRes.data);
    } catch (error) {
      console.error("Error fetching wallet data:", error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWalletData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchWalletData]);

  async function handleRequestPayout() {
    const amount = parseInt(withdrawAmount);
    const rupiahWallet = wallets.find(w => w.currency_type === 'RUPIAH');
    
    if (!amount || amount <= 0) {
      toast.error(t.wallet.enterValidAmount);
      return;
    }
    
    if (!rupiahWallet || amount > rupiahWallet.balance_available) {
      toast.error(t.wallet.insufficientRupiah);
      return;
    }

    if (amount < 25000) {
      toast.error(t.wallet.minWithdrawRupiah);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    
    const { error } = await supabase.from("withdrawal_requests").insert({
      student_id: profile!.id,
      wallet_id: rupiahWallet.id,
      amount
    });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.wallet.requestSuccess);

      // Notify admins about the new withdrawal request (as backup to DB trigger)
      fetch("/api/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pending_withdrawals",
          category: "transactional",
          priority: "medium",
          title: "New Withdrawal Request",
          message: `${profile?.full_name || "A student"} requested a payout of Rp ${amount.toLocaleString("id-ID")}.`,
          action_url: "/admin/withdrawals",
        }),
      }).catch(err => console.error("Failed to send admin notification:", err));

      setWithdrawAmount("");
      fetchWalletData();
    }
  }

  const selectPresetAmount = (amount: number) => {
    setWithdrawAmount(String(amount));
  };

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const rupiahWallet = wallets.find(w => w.currency_type === 'RUPIAH');

  // Filtered transactions
  const filteredTxs = transactions.filter(tx => {
    if (txCurrencyFilter === "ALL") return true;
    return tx.currency_type === txCurrencyFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-8 max-w-md lg:max-w-4xl mx-auto px-1">
      {/* Top Header */}
      <div className="flex justify-between items-center py-1 lg:hidden">
        <div>
          <span className="text-xs font-extrabold text-muted-foreground">My Finance</span>
          <h2 className="font-black text-lg text-foreground leading-none mt-1">My Wallet</h2>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-5 lg:gap-6 space-y-6 lg:space-y-0">
      <div className="space-y-6 lg:col-span-2">
      {/* Cash Balance Hero Card (Mockup 3 styling) */}
      <div className="card rounded-[32px] p-6 border border-border/30 bg-card space-y-5 shadow-sm relative overflow-hidden">
        <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-amber-500/5 flex items-center justify-center">
          <WalletIcon className="h-7 w-7 text-amber-600/70" />
        </div>
        
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Cash Balance</p>
          <h2 className="text-3.5xl font-black text-[#8B5E00] dark:text-amber-500 mt-2.5 leading-none">
            {formatCurrency(rupiahWallet?.balance_available || 0)}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button 
            disabled 
            className="py-3 rounded-2xl bg-muted/60 text-muted-foreground font-extrabold text-xs text-center cursor-not-allowed opacity-50"
          >
            Top Up
          </button>
          <button 
            onClick={() => setShowWithdrawSheet(true)}
            className="py-3 rounded-2xl bg-teal-500 hover:bg-teal-600 active:scale-[0.98] transition-all text-white font-extrabold text-xs text-center shadow-md shadow-teal-500/10 border-0"
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* Two circular/grid cards below (Coins and XP) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Virtual Coins Card */}
        <div className="card rounded-[28px] p-5 border border-border/30 bg-card text-center flex flex-col items-center justify-between shadow-sm min-h-[135px]">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Coins className="h-5 w-5 text-amber-500 fill-amber-500/20" />
          </div>
          <div className="mt-3">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Virtual Coins</p>
            <p className="text-xl font-black text-foreground mt-1.5 leading-none">{profile?.coins?.toLocaleString("id-ID") || 0}</p>
          </div>
        </div>

        {/* XP Points Card */}
        <div className="card rounded-[28px] p-5 border border-border/30 bg-card text-center flex flex-col items-center justify-between shadow-sm min-h-[135px]">
          <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Award className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-3">
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">XP Points</p>
            <p className="text-xl font-black text-foreground mt-1.5 leading-none">{profile?.xp?.toLocaleString("id-ID") || 0}</p>
          </div>
        </div>
      </div>

      {/* Detail Breakdown of balances */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-muted/30 border border-border/20 p-4 rounded-2xl flex items-center gap-3">
          <div className="h-8.5 w-8.5 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider leading-none mb-1">Pending Approval</p>
            <p className="text-xs font-black text-amber-600 leading-none">
              {formatCurrency(rupiahWallet?.balance_pending || 0)}
            </p>
          </div>
        </div>
        <div className="bg-muted/30 border border-border/20 p-4 rounded-2xl flex items-center gap-3">
          <div className="h-8.5 w-8.5 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider leading-none mb-1">Locked (End Month)</p>
            <p className="text-xs font-black text-blue-600 leading-none">
              {formatCurrency(rupiahWallet?.balance_locked || 0)}
            </p>
          </div>
        </div>
      </div>
      </div>
      <div className="space-y-6 lg:col-span-3">

      {/* Recent Activity Ledger List */}
      <div className="card rounded-[32px] p-6 border border-border/30 bg-card space-y-5 shadow-sm">
        <div className="flex justify-between items-center pb-2 border-b border-border/20">
          <h3 className="font-black text-sm text-foreground">Recent Activity</h3>
          <button 
            onClick={() => {
              setTxCurrencyFilter("ALL");
              // Fallback view trigger or just show all
            }}
            className="text-[10px] font-black uppercase text-primary hover:underline"
          >
            See All
          </button>
        </div>

        <div className="space-y-0 divide-y divide-border/20">
          {filteredTxs.slice(0, 10).map(tx => {
            const isGain = tx.amount > 0;
            const isCoin = tx.currency_type === 'COIN';
            return (
              <div key={tx.id} className="flex justify-between items-center py-3.5 text-xs font-semibold first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    isCoin 
                      ? "bg-amber-500/10 text-amber-600" 
                      : isGain 
                        ? "bg-emerald-500/10 text-emerald-600" 
                        : "bg-rose-500/10 text-rose-600"
                  }`}>
                    {isCoin ? (
                      <Coins className="h-4 w-4" />
                    ) : (
                      <WalletIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-foreground leading-snug">{tx.note || tx.event_type}</h4>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-black text-xs block ${isGain ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isGain ? '+' : ''}{tx.amount.toLocaleString("id-ID")}
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-wider block ${isCoin ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {tx.currency_type}
                  </span>
                </div>
              </div>
            );
          })}
          {filteredTxs.length === 0 && (
            <div className="text-center text-muted-foreground py-8 font-semibold text-xs">
              No recent wallet transactions.
            </div>
          )}
        </div>
      </div>

      {/* Payout History Section */}
      {payoutRequests.length > 0 && (
        <div className="card rounded-[32px] p-6 border border-border/30 bg-card space-y-4 shadow-sm">
          <h3 className="font-black text-sm text-foreground">Withdrawal History</h3>
          <div className="space-y-0 divide-y divide-border/20">
            {payoutRequests.slice(0, 5).map(req => {
              const requiresToken = req.status === 'approved' || req.status === 'token_issued' || req.status === 'expired';
              const content = (
              <div className="flex justify-between items-center py-3 text-xs font-semibold first:pt-0 last:pb-0">
                <div>
                  <p className="font-black text-foreground">{formatCurrency(req.amount)}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{formatDate(req.requested_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {requiresToken && <ArrowRight className="h-4 w-4 text-primary" />}
                  <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${
                    req.status === 'redeemed' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                      : req.status === 'approved' || req.status === 'token_issued' 
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' 
                      : req.status === 'pending' 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                  }`}>
                    {req.status}
                  </span>
                </div>
              </div>
              );

              return requiresToken ? (
                <Link href={`/student/wallet/withdrawals/${req.id}`} key={req.id} className="block hover:bg-muted/30 transition-colors -mx-2 px-2 rounded-xl">
                  {content}
                </Link>
              ) : (
                <div key={req.id}>{content}</div>
              );
            })}
          </div>
        </div>
      )}
      </div>
      </div>

      {/* Slide-Up Bottom Sheet for Payout/Withdrawal */}
      {showWithdrawSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in">
          {/* Backdrop */}
          <div 
            onClick={() => setShowWithdrawSheet(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
          />
          {/* Content Sheet */}
          <div className="relative w-full max-w-md bg-background border-t border-border/40 rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 z-10 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto" />
            
            <div>
              <h3 className="font-black text-base text-foreground">Withdraw Earnings</h3>
              <p className="text-[10px] text-muted-foreground mt-1">Convert your available Rupiah balance into cash. Minimum transfer is Rp 25.000.</p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {[25000, 50000, 100000, 250000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => selectPresetAmount(val)}
                  className="py-2.5 px-3 rounded-xl border border-border/40 bg-card hover:bg-muted text-xs font-black text-center transition-all"
                >
                  Rp {val.toLocaleString("id-ID")}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs">Rp</span>
                <input 
                  type="number" 
                  className="input w-full pl-9 py-3 rounded-xl font-bold text-xs" 
                  placeholder="Enter custom amount" 
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                />
              </div>
              
              <button 
                onClick={async () => {
                  await handleRequestPayout();
                  setShowWithdrawSheet(false);
                }}
                disabled={submitting}
                className="w-full bg-teal-500 hover:bg-teal-600 active:scale-[0.98] text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 border-0 shadow-md shadow-teal-500/10 transition-all"
              >
                {submitting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ArrowRight className="h-4.5 w-4.5" />}
                Confirm Withdrawal
              </button>
            </div>

            <div className="flex items-start gap-2 text-[9px] text-muted-foreground/80 leading-normal bg-muted/40 p-3 rounded-xl border border-border/20">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              <p>Payout transfers are processed by the school administration within 1-2 business days. Available Rupiah balance will be locked upon submitting.</p>
            </div>

            <button 
              onClick={() => setShowWithdrawSheet(false)}
              className="w-full py-2.5 rounded-xl border border-border/40 text-xs font-bold hover:bg-muted/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
