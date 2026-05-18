"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Wallet, ArrowDownRight, ArrowUpRight, Lock, Loader2, CreditCard } from "lucide-react";
import type { Wallet as WalletType, WalletTransaction, WithdrawalRequest } from "@/lib/types/database";

export default function WalletPage() {
  const { profile } = useUserRole();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "withdraw">("overview");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState("");

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    async function load() {
      const [walRes, txRes, wdRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("student_id", profile!.id).single(),
        supabase.from("wallet_transactions").select("*").eq("wallet_id", profile!.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("withdrawal_requests").select("*").eq("student_id", profile!.id).order("requested_at", { ascending: false }).limit(10),
      ]);
      if (walRes.data) setWallet(walRes.data);
      setTransactions((txRes.data || []) as WalletTransaction[]);
      setWithdrawals((wdRes.data || []) as WithdrawalRequest[]);
      setLoading(false);
    }
    load();
  }, [profile]);

  const handleWithdraw = async () => {
    if (!profile || !wallet) return;
    const amount = parseInt(withdrawAmount);
    if (!amount || amount <= 0) { setWithdrawMsg("Please enter a valid amount greater than 0"); return; }
    if (amount > wallet.available_balance) { setWithdrawMsg("Insufficient balance. You cannot withdraw more than your available amount."); return; }

    setWithdrawing(true);
    setWithdrawMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("withdrawal_requests").insert({
        wallet_id: wallet.id,
        student_id: profile.id,
        amount,
        status: "pending",
      });

      if (error) { 
        throw new Error(error.message); 
      }
      setWithdrawMsg("Withdrawal request submitted successfully!"); 
      setWithdrawAmount(""); 
      
      // Refresh withdrawals list locally
      setWithdrawals((prev) => [{ id: Math.random().toString(), wallet_id: wallet.id, student_id: profile.id, amount, status: "pending", requested_at: new Date().toISOString() } as unknown as WithdrawalRequest, ...prev]);
    } catch (err: any) {
      setWithdrawMsg(`Error submitting request: ${err.message || "Unknown error"}`);
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const txIcon = (type: string) => {
    if (type.includes("withdrawal")) return <ArrowUpRight className="h-4 w-4 text-red-400" />;
    if (type.includes("hold")) return <Lock className="h-4 w-4 text-blue-400" />;
    return <ArrowDownRight className="h-4 w-4 text-emerald-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold flex items-center gap-2"><Wallet className="h-5 w-5" /> Wallet</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Available</p><p className="text-lg font-bold text-emerald-500">{formatCurrency(wallet?.available_balance || 0)}</p></div>
        <div className="glass rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Pending</p><p className="text-lg font-bold text-amber-500">{formatCurrency(wallet?.pending_balance || 0)}</p></div>
        <div className="glass rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground mb-1">Held</p><p className="text-lg font-bold text-blue-500">{formatCurrency(wallet?.held_balance || 0)}</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("overview")} className={`px-4 py-2 rounded-full text-sm font-medium ${tab === "overview" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Transactions</button>
        <button onClick={() => setTab("withdraw")} className={`px-4 py-2 rounded-full text-sm font-medium ${tab === "withdraw" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Withdraw</button>
      </div>

      {tab === "overview" && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <EmptyState icon={CreditCard} title="No transactions" description="Your reward transactions will appear here." />
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="glass rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">{txIcon(tx.type)}</div>
                  <div><p className="text-sm font-medium">{tx.description}</p><p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p></div>
                </div>
                <p className={`text-sm font-bold ${tx.type.includes("withdrawal") ? "text-red-400" : "text-emerald-400"}`}>{tx.type.includes("withdrawal") ? "-" : "+"}{formatCurrency(tx.amount)}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "withdraw" && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold">Request Withdrawal</h2>
          <p className="text-sm text-muted-foreground">Minimum once per week. Available: {formatCurrency(wallet?.available_balance || 0)}</p>
          
          {wallet?.available_balance === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3 text-xs font-medium">
              You do not have any available balance to withdraw. Complete attendance to earn rewards!
            </div>
          )}

          <input 
            type="number" 
            value={withdrawAmount} 
            onChange={(e) => setWithdrawAmount(e.target.value)} 
            placeholder="Enter amount (IDR)" 
            disabled={wallet?.available_balance === 0 || withdrawing}
            className="w-full px-3.5 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50" 
          />
          
          {withdrawMsg && (
            <div className={`text-xs rounded-xl px-4 py-3 flex items-center gap-2 ${
              withdrawMsg.includes("success") || withdrawMsg.includes("submitted")
                ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"
                : "text-destructive bg-destructive/10 border border-destructive/20"
            }`}>
              <span className="font-bold shrink-0">{withdrawMsg.includes("success") || withdrawMsg.includes("submitted") ? "✓" : "!"}</span>
              {withdrawMsg}
            </div>
          )}

          <button 
            onClick={handleWithdraw} 
            disabled={withdrawing || wallet?.available_balance === 0} 
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {withdrawing ? "Submitting..." : "Request Withdrawal"}
          </button>

          {withdrawals.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border">
              <h3 className="text-sm font-medium">Withdrawal History</h3>
              {withdrawals.map((wd) => (
                <div key={wd.id} className="flex items-center justify-between text-sm bg-muted rounded-lg p-3">
                  <div><p className="font-medium">{formatCurrency(wd.amount)}</p><p className="text-xs text-muted-foreground">{formatDate(wd.requested_at)}</p></div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${wd.status === "approved" ? "bg-emerald-500/10 text-emerald-500" : wd.status === "rejected" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{wd.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
