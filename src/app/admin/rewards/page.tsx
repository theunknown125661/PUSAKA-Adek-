"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils/format";
import { Gift, Loader2, Save, History, TrendingUp, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { WalletTransaction } from "@/lib/types/database";
import { Clock, Settings as SettingsIcon } from "lucide-react";

type AuditTransaction = {
  id: string;
  user_id: string;
  amount: number;
  event_type: string;
  note: string;
  created_at: string;
  profiles?: { full_name: string } | null;
};



export default function RewardsAdminPage() {
  const { t, interpolate, isClient } = useTranslation();
  const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("school_id, id, role").eq("id", user?.id).single();
      
      let schoolId = profile?.school_id;
      if (!schoolId && profile?.role === "admin") {
        const { data: assignments } = await supabase.from("school_admin_assignments").select("school_id").eq("user_id", profile?.id).limit(1);
        if (assignments && assignments.length > 0) schoolId = assignments[0].school_id;
      }
      
      if (!schoolId) {
        const { data: firstSchool } = await supabase.from("schools").select("id").limit(1).single();
        if (firstSchool) schoolId = firstSchool.id;
      }

      if (schoolId) {
        const { data: tData } = await supabase.from("wallet_transactions").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(50);
        if (tData) setTransactions(tData as any[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  

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
          .select("*, wallets!inner(user_id, profiles!inner(full_name))")
          .order("created_at", { ascending: false })
          .limit(50);
      if (data) setTransactions(data as AuditTransaction[]);
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
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

      <div className="grid grid-cols-1 gap-6">
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
                      <p className="text-sm font-medium">{tx.profiles?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{tx.note || "No notes"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        tx.amount < 0 ? "text-red-500" : "text-emerald-500"
                      }`}>
                        {tx.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(tx.amount))}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{(tx.event_type || "").replace(/_/g, ' ')}</p>
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
