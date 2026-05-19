"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/format";
import { Gift, Loader2, Save, History, TrendingUp, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { WalletTransaction } from "@/lib/types/database";

type AuditTransaction = WalletTransaction & {
  wallets?: { student_id: string; profiles?: { full_name: string } };
};

interface RulesConfig {
  id: string;
  base_reward: number;
  early_bonus: number;
  monthly_hold_bonus_pct: number;
  attendance_start_time: string;
  attendance_end_time: string;
  early_cutoff_time: string;
  min_withdrawal_amount: number;
  economy_config?: any;
}

export default function RewardsAdminPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [rules, setRules] = useState<RulesConfig | null>(null);
  const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [rRes, tRes] = await Promise.all([
        supabase.from("reward_rules").select("*").limit(1).single(),
        supabase.from("wallet_transactions")
          .select("*, wallets!inner(student_id, profiles!inner(full_name))")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      
      if (rRes.data) setRules(rRes.data as RulesConfig);
      if (tRes.data) setTransactions(tRes.data as AuditTransaction[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!rules) return;
    setSaving(true);
    setMsg("");
    const supabase = createClient();
    
    const { error } = await supabase
      .from("reward_rules")
      .update({ 
        base_reward: rules.base_reward, 
        early_bonus: rules.early_bonus, 
        monthly_hold_bonus_pct: rules.monthly_hold_bonus_pct, 
        attendance_start_time: rules.attendance_start_time, 
        attendance_end_time: rules.attendance_end_time, 
        early_cutoff_time: rules.early_cutoff_time, 
        min_withdrawal_amount: rules.min_withdrawal_amount,
        economy_config: rules.economy_config
      })
      .eq("id", rules.id);
      
    if (error) setMsg(t.adminRewards.errorSaving);
    else setMsg(t.adminRewards.successSaving);
    
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const processMonthlyHold = async () => {
    const confirm = window.confirm(t.adminRewards.monthlyConfirm);
    if (!confirm) return;
    
    setSaving(true);
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase.rpc("process_monthly_hold");
    
    if (error) setMsg(interpolate(t.adminRewards.monthlyError, { message: error.message }));
    else {
      setMsg(t.adminRewards.monthlySuccess);
      // Reload transactions
      const { data } = await supabase
          .from("wallet_transactions")
          .select("*, wallets!inner(student_id, profiles!inner(full_name))")
          .order("created_at", { ascending: false })
          .limit(50);
      if (data) setTransactions(data as AuditTransaction[]);
    }
    setSaving(false);
  };

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const field = (label: string, value: string | number, onChange: (v: string) => void, type = "text") => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-primary">
            <Gift className="h-5 w-5" /> {t.adminRewards.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.adminRewards.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rules Editor */}
        <div className="space-y-4">
          {rules && (
            <div className="glass rounded-2xl p-5 space-y-4 border border-primary/20">
              <h2 className="font-semibold text-primary flex items-center gap-2"><Wallet className="h-4 w-4" /> {t.adminRewards.financialRules}</h2>
              
              <div className="space-y-4">
                {/* Coins Config */}
                <div className="space-y-2">
                  <h3 className="font-medium text-xs text-amber-600 uppercase tracking-wider">{t.adminRewards.coinsTitle}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {field(t.adminRewards.attendancePresent, rules.economy_config?.coins?.attendance_present || 20, (v) => setRules({ 
                      ...rules, 
                      economy_config: { 
                        ...rules.economy_config, 
                        coins: { ...rules.economy_config?.coins, attendance_present: parseInt(v) || 0 } 
                      } 
                    }), "number")}
                    {field(t.adminRewards.onTimeBonus, rules.economy_config?.coins?.attendance_ontime || 10, (v) => setRules({ 
                      ...rules, 
                      economy_config: { 
                        ...rules.economy_config, 
                        coins: { ...rules.economy_config?.coins, attendance_ontime: parseInt(v) || 0 } 
                      } 
                    }), "number")}
                  </div>
                </div>

                {/* Rupiah Config */}
                <div className="space-y-2">
                  <h3 className="font-medium text-xs text-emerald-600 uppercase tracking-wider">{t.adminRewards.rupiahTitle}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {field(t.adminRewards.attendancePresentRp, rules.economy_config?.rupiah?.attendance_present || 1000, (v) => setRules({ 
                      ...rules, 
                      economy_config: { 
                        ...rules.economy_config, 
                        rupiah: { ...rules.economy_config?.rupiah, attendance_present: parseInt(v) || 0 } 
                      } 
                    }), "number")}
                    {field(t.adminRewards.onTimeBonusRp, rules.economy_config?.rupiah?.attendance_ontime || 500, (v) => setRules({ 
                      ...rules, 
                      economy_config: { 
                        ...rules.economy_config, 
                        rupiah: { ...rules.economy_config?.rupiah, attendance_ontime: parseInt(v) || 0 } 
                      } 
                    }), "number")}
                  </div>
                </div>

                {/* System Values */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  {field(t.adminRewards.minWithdrawal, rules.min_withdrawal_amount, (v) => setRules({ ...rules, min_withdrawal_amount: parseInt(v) || 0 }), "number")}
                  {field(t.adminRewards.monthlyHoldPct, rules.monthly_hold_bonus_pct, (v) => setRules({ ...rules, monthly_hold_bonus_pct: parseFloat(v) || 0 }), "number")}
                </div>
              </div>
              
              <h2 className="font-semibold pt-2 text-primary flex items-center gap-2"><History className="h-4 w-4" /> {t.adminRewards.timeWindows}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field(t.adminRewards.startTime, rules.attendance_start_time, (v) => setRules({ ...rules, attendance_start_time: v }), "time")}
                {field(t.adminRewards.endTime, rules.attendance_end_time, (v) => setRules({ ...rules, attendance_end_time: v }), "time")}
                {field(t.adminRewards.earlyCutoff, rules.early_cutoff_time, (v) => setRules({ ...rules, early_cutoff_time: v }), "time")}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-border">
                <span className={`text-xs font-medium ${msg.includes("Gagal") || msg.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>{msg}</span>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-colors">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {saving ? t.adminRewards.savingStatus : t.adminRewards.saveConfig}
                </button>
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-5 border border-indigo-500/20">
            <h2 className="font-semibold text-indigo-500 flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4" /> {t.adminRewards.monthlyProcessing}</h2>
            <p className="text-xs text-muted-foreground mb-4">{t.adminRewards.monthlyProcessingDesc}</p>
            <button onClick={processMonthlyHold} disabled={saving} className="w-full py-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 font-semibold text-sm hover:bg-indigo-500/20 transition-colors">
              {t.adminRewards.executeMonthly}
            </button>
          </div>
        </div>

        {/* Audit Log */}
        <div className="glass rounded-2xl p-5 flex flex-col h-[600px]">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><History className="h-5 w-5" /> {t.adminRewards.auditLog}</h2>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 hide-scrollbar">
            {transactions.length === 0 ? (
              <EmptyState icon={History} title={t.adminRewards.noTransactions} description={t.adminRewards.noTransactionsDesc} />
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="bg-card/50 rounded-xl p-3 border border-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{tx.wallets?.profiles?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{tx.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        tx.type === "withdrawal" || tx.type === "hold_lock" ? "text-red-500" : "text-emerald-500"
                      }`}>
                        {tx.type === "withdrawal" || tx.type === "hold_lock" ? "-" : "+"}{formatCurrency(tx.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{tx.type.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2 flex justify-between">
                    <span>{formatDate(tx.created_at)}</span>
                    <span>{formatTime(tx.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
