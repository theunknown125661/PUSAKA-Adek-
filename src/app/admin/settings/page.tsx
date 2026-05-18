"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, Loader2, Save, MapPin, ShieldAlert } from "lucide-react";

interface SchoolConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
}

export default function AdminSettingsPage() {
  const [school, setSchool] = useState<SchoolConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data } = await supabase.from("schools").select("*").limit(1).single();
      if (data) setSchool(data as SchoolConfig);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    setMsg("");
    const supabase = createClient();
    
    const { error } = await supabase
      .from("schools")
      .update({ 
        name: school.name, 
        latitude: school.latitude, 
        longitude: school.longitude, 
        radius_m: school.radius_m 
      })
      .eq("id", school.id);
      
    if (error) setMsg("Error saving settings");
    else setMsg("Settings saved successfully!");
    
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const field = (label: string, value: string | number, onChange: (v: string) => void, type = "text") => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" 
      />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5" /> System Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configure global application parameters and geofencing</p>
      </div>

      {school && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2 text-primary"><MapPin className="h-4 w-4" /> School Location (Geofence)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              {field("School Name", school.name, (v) => setSchool({ ...school, name: v }))}
            </div>
            {field("Latitude", school.latitude, (v) => setSchool({ ...school, latitude: parseFloat(v) || 0 }), "number")}
            {field("Longitude", school.longitude, (v) => setSchool({ ...school, longitude: parseFloat(v) || 0 }), "number")}
            {field("Allowed Radius (meters)", school.radius_m, (v) => setSchool({ ...school, radius_m: parseInt(v) || 0 }), "number")}
          </div>
          
          <div className="bg-muted p-3 rounded-xl mt-4 border border-border flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">Geofencing Warning</p>
              <p className="text-xs text-muted-foreground mt-1">
                Changing the latitude, longitude, or radius will immediately affect all student check-ins. 
                Students checking in outside of the new radius will have their attendance flagged for manual review.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving..." : "Save Configuration"}
        </button>
        {msg && <p className={`text-sm font-medium ${msg.includes("Error") ? "text-destructive" : "text-emerald-500"}`}>{msg}</p>}
      </div>
    </div>
  );
}
