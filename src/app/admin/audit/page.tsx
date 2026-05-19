"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import { FileText, Search } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils/format";
import { EmptyState } from "@/components/shared/empty-state";

type AuditRecord = {
  id: string;
  created_at: string;
  reviewer_role: string;
  action: string;
  note: string | null;
  reviewer: { full_name: string } | null;
  attendance_logs: {
    attendance_date: string;
    profiles: { full_name: string } | null;
  } | null;
};

export default function AdminAuditPage() {
  const { t, isClient } = useTranslation();
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data } = await supabase
        .from("attendance_reviews")
        .select("*, reviewer:profiles!reviewer_id(full_name), attendance_logs!inner(attendance_date, profiles!student_id(full_name))")
        .order("created_at", { ascending: false })
        .limit(100);
      
      setLogs((data || []) as unknown as AuditRecord[]);
      setLoading(false);
    }
    load();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const reviewerName = log.reviewer?.full_name?.toLowerCase() || "";
    const studentName = log.attendance_logs?.profiles?.full_name?.toLowerCase() || "";
    const action = log.action.toLowerCase();
    return reviewerName.includes(search) || studentName.includes(search) || action.includes(search);
  });

  if (!isClient || loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" /> {t.adminAudit.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.adminAudit.subtitle}</p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={t.adminAudit.searchPlaceholder} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
          />
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold">{t.adminAudit.thTimestamp}</th>
                <th className="px-6 py-4 font-semibold">{t.adminAudit.thReviewer}</th>
                <th className="px-6 py-4 font-semibold">{t.adminAudit.thAction}</th>
                <th className="px-6 py-4 font-semibold">{t.adminAudit.thTargetStudent}</th>
                <th className="px-6 py-4 font-semibold">{t.adminAudit.thTargetDate}</th>
                <th className="px-6 py-4 font-semibold">{t.adminAudit.thNotes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10">
                    <EmptyState icon={FileText} title={t.adminAudit.noLogs} description={t.adminAudit.adjustSearch} />
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="block font-medium">{formatDate(log.created_at)}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(log.created_at)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{log.reviewer?.full_name}</span>
                      <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">{log.reviewer_role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        log.action === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {log.action === 'approved' ? t.adminReports.approved : t.adminReports.rejected}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {log.attendance_logs?.profiles?.full_name}
                    </td>
                    <td className="px-6 py-4">
                      {log.attendance_logs?.attendance_date ? formatDate(log.attendance_logs.attendance_date) : '-'}
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate text-muted-foreground text-xs">
                      {log.note || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
