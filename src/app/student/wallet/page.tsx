"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Lock, Clock, Plus, Coins, Banknote, Loader2, Award, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  state: string;
  created_at: string;
};

export default function WalletPage() {
  const { profile } = useUserRole();
  const { t, isClient } = useTranslation();
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"transactions" | "payouts">("transactions");
  const [txCurrencyFilter, setTxCurrencyFilter] = useState<"ALL" | "COIN" | "RUPIAH">("ALL");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchWalletData();
  }, [profile]);

  async function fetchWalletData() {
    setLoading(true);
    const supabase = createClient();
    
    const [walletsRes, txRes, requestsRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", profile!.id),
      supabase.from("wallet_transactions").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("payout_requests").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(15)
    ]);
    
    if (walletsRes.data) setWallets(walletsRes.data);
    if (txRes.data) setTransactions(txRes.data);
    if (requestsRes.data) setPayoutRequests(requestsRes.data);
    
    setLoading(false);
  }

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
    
    const { error } = await supabase.from("payout_requests").insert({
      user_id: profile!.id,
      amount,
      destination: "cash",
      state: "REQUESTED"
    });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.wallet.requestSuccess);
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

  const coinWallet = wallets.find(w => w.currency_type === 'COIN');
  const rupiahWallet = wallets.find(w => w.currency_type === 'RUPIAH');

  // Filtered transactions
  const filteredTxs = transactions.filter(tx => {
    if (txCurrencyFilter === "ALL") return true;
    return tx.currency_type === txCurrencyFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <WalletIcon className="h-6 w-6 text-primary" />
          {t.wallet.title}
        </h1>
        <p className="text-muted-foreground text-xs mt-1">{t.wallet.subtitle}</p>
      </div>

      {/* 3 Gamified Header Pills (XP, Coins, Rupiah) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* XP Card */}
        <div className="card rounded-[28px] p-5 flex flex-col justify-between border border-border/50 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Award className="h-5 w-5 text-indigo-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full">
              Level {profile?.level || 1}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Experience Points</p>
            <p className="text-2xl font-black mt-1 leading-none">{profile?.xp || 0} XP</p>
          </div>
        </div>

        {/* Coins Card */}
        <div className="card rounded-[28px] p-5 flex flex-col justify-between border border-border/50 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-amber-500 animate-pulse" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
              Shop Coins
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Coins Balance</p>
            <p className="text-2xl font-black mt-1 leading-none">{profile?.coins || 0} C</p>
          </div>
        </div>

        {/* Rupiah Card */}
        <div className="card rounded-[28px] p-5 flex flex-col justify-between border border-border/50 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
          <div className="flex justify-between items-start">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">
              Cash Payouts
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Available Balance</p>
            <p className="text-2xl font-black mt-1 leading-none text-emerald-600 dark:text-emerald-500">
              {formatCurrency(rupiahWallet?.balance_available || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Rupiah Ledger Breakdowns (Pending/Locked) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border/40 p-4.5 rounded-2xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Pending approval</p>
            <p className="text-sm font-extrabold text-amber-600 leading-none">
              {formatCurrency(rupiahWallet?.balance_pending || 0)}
            </p>
          </div>
        </div>
        <div className="bg-card border border-border/40 p-4.5 rounded-2xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <Lock className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Locked (End of Month)</p>
            <p className="text-sm font-extrabold text-blue-600 leading-none">
              {formatCurrency(rupiahWallet?.balance_locked || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Pill Tabs Selector */}
      <div className="bg-muted/60 p-1 rounded-2xl flex gap-1 max-w-md">
        <button 
          onClick={() => setActiveTab("transactions")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'transactions' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Transactions Ledger
        </button>
        <button 
          onClick={() => setActiveTab("payouts")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'payouts' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Withdraw Rewards
        </button>
      </div>

      {/* Main tab panel cards */}
      <div className="card rounded-[32px] p-6 border border-border/50 bg-card">
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {/* Filter chips */}
            <div className="flex flex-wrap gap-1.5 border-b border-border/40 pb-4">
              <button 
                onClick={() => setTxCurrencyFilter("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                  txCurrencyFilter === "ALL" 
                    ? "bg-primary/10 border-primary/20 text-primary" 
                    : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                All Transactions
              </button>
              <button 
                onClick={() => setTxCurrencyFilter("COIN")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                  txCurrencyFilter === "COIN" 
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-600" 
                    : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                Coins Ledger
              </button>
              <button 
                onClick={() => setTxCurrencyFilter("RUPIAH")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                  txCurrencyFilter === "RUPIAH" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" 
                    : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                Rupiah Ledger
              </button>
            </div>

            <div className="space-y-0 divide-y divide-border/40">
              {filteredTxs.map(tx => (
                <div key={tx.id} className="flex justify-between items-center py-4 text-xs font-semibold first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="font-extrabold text-sm leading-snug">{tx.note || tx.event_type}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <span className={`font-black text-sm block ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString("id-ID")}
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider block ${tx.currency_type === 'COIN' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {tx.currency_type}
                      </span>
                    </div>

                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      tx.state === 'RELEASED' || tx.state === 'APPROVED' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                        : tx.state === 'PENDING' 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' 
                        : 'bg-muted border-transparent text-muted-foreground'
                    }`}>
                      {tx.state}
                    </span>
                  </div>
                </div>
              ))}
              {filteredTxs.length === 0 && (
                <div className="text-center text-muted-foreground py-10 font-semibold text-xs">
                  {t.wallet.noTransactions}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'payouts' && (
          <div className="space-y-6">
            {/* Request Form with presets */}
            <div className="bg-muted/30 border border-border/40 p-5 rounded-[24px] space-y-4">
              <div>
                <h3 className="font-extrabold text-sm">{t.wallet.requestPayoutHeader}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Submit a payout request to transfer school streak earnings to cash.</p>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[25000, 50000, 100000, 250000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => selectPresetAmount(val)}
                    className="py-2 px-3 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold text-center transition-all"
                  >
                    Rp {val.toLocaleString("id-ID")}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs">Rp</span>
                  <input 
                    type="number" 
                    className="input w-full pl-9 py-3 rounded-xl font-bold text-xs" 
                    placeholder="Enter Custom Amount (Min 25,000)" 
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleRequestPayout}
                  disabled={submitting}
                  className="btn btn-primary px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0 border-0"
                >
                  {submitting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ArrowRight className="h-4.5 w-4.5" />}
                  Withdraw
                </button>
              </div>
              <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground leading-snug px-1">
                <AlertCircle className="h-3 w-3 shrink-0 text-muted-foreground/60 mt-0.5" />
                <p>{t.wallet.payoutInfo}</p>
              </div>
            </div>

            {/* Request History */}
            <div className="space-y-4 pt-2">
              <h3 className="font-extrabold text-sm">{t.wallet.payoutHistoryHeader}</h3>
              <div className="space-y-0 divide-y divide-border/40">
                {payoutRequests.map(req => (
                  <div key={req.id} className="flex justify-between items-center py-3.5 text-xs font-semibold first:pt-0 last:pb-0">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-sm">{formatCurrency(req.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(req.created_at)}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      req.state === 'PAID' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                        : req.state === 'APPROVED' 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' 
                        : req.state === 'REQUESTED' 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                    }`}>
                      {req.state}
                    </span>
                  </div>
                ))}
                {payoutRequests.length === 0 && (
                  <div className="text-center text-muted-foreground py-6 font-semibold text-xs">{t.wallet.noPayouts}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
