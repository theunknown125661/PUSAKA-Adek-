"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Lock, Clock, Plus, Coins, Banknote, Loader2 } from "lucide-react";
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
      supabase.from("wallet_transactions").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("payout_requests").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(10)
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
      fetchWalletData(); // Refresh
    }
  }

  if (!isClient || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const coinWallet = wallets.find(w => w.currency_type === 'COIN');
  const rupiahWallet = wallets.find(w => w.currency_type === 'RUPIAH');

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <WalletIcon className="h-6 w-6 text-primary" />
          {t.wallet.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t.wallet.subtitle}</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coins Card */}
        <div className="card rounded-3xl p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">{t.wallet.virtualCurrency}</p>
              <h2 className="text-3xl font-black mt-1 flex items-center gap-2">
                <Coins className="h-8 w-8 text-amber-500" />
                {coinWallet?.balance_available || 0}
              </h2>
            </div>
            <span className="text-[10px] font-bold bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded-full uppercase">{t.shop.coins}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t.wallet.coinsDesc}</p>
        </div>

        {/* Rupiah Card */}
        <div className="card rounded-3xl p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{t.wallet.realRewards}</p>
              <h2 className="text-3xl font-black mt-1 flex items-center gap-2">
                <Banknote className="h-8 w-8 text-emerald-500" />
                {formatCurrency(rupiahWallet?.balance_available || 0)}
              </h2>
              {(rupiahWallet?.balance_pending || 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t.dashboard.pending}: {formatCurrency(rupiahWallet!.balance_pending)}
                </p>
              )}
            </div>
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Rupiah</span>
          </div>
          <p className="text-sm text-muted-foreground">{t.wallet.rupiahDesc}</p>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="card rounded-3xl overflow-hidden">
        <div className="flex border-b">
          <button 
            onClick={() => setActiveTab("transactions")}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'transactions' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.history.filters.all}
          </button>
          <button 
            onClick={() => setActiveTab("payouts")}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === 'payouts' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.wallet.payoutsTab}
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {transactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center py-3 border-b last:border-0 text-sm">
                  <div>
                    <p className="font-bold">{tx.note || tx.event_type}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${tx.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                    <span className={`text-xs font-bold uppercase ${tx.currency_type === 'COIN' ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {tx.currency_type}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                      tx.state === 'RELEASED' || tx.state === 'APPROVED' ? 'bg-success/10 text-success' :
                      tx.state === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {tx.state}
                    </span>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">{t.wallet.noTransactions}</div>
              )}
            </div>
          )}

          {activeTab === 'payouts' && (
            <div className="space-y-6">
              {/* Request Form */}
              <div className="bg-muted/30 p-5 rounded-2xl">
                <h3 className="font-bold text-sm mb-3">{t.wallet.requestPayoutHeader}</h3>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">Rp</span>
                    <input 
                      type="number" 
                      className="input w-full pl-10" 
                      placeholder="Amount (Min 25,000)" 
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={handleRequestPayout}
                    disabled={submitting}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {t.wallet.withdrawTab}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">{t.wallet.payoutInfo}</p>
              </div>

              {/* Request History */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm">{t.wallet.payoutHistoryHeader}</h3>
                {payoutRequests.map(req => (
                  <div key={req.id} className="flex justify-between items-center py-3 border-b last:border-0 text-sm">
                    <div>
                      <p className="font-bold">{formatCurrency(req.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(req.created_at)}</p>
                    </div>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                      req.state === 'PAID' ? 'bg-success/10 text-success' :
                      req.state === 'APPROVED' ? 'bg-blue-500/10 text-blue-500' :
                      req.state === 'REQUESTED' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {req.state}
                    </span>
                  </div>
                ))}
                {payoutRequests.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">{t.wallet.noPayouts}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
