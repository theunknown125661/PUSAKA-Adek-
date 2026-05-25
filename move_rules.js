const fs = require('fs');

const rewardsPath = 'e:/Develop/School Streak/src/app/admin/rewards/page.tsx';
const settingsPath = 'e:/Develop/School Streak/src/app/admin/settings/page.tsx';

let rewardsCode = fs.readFileSync(rewardsPath, 'utf8');
let settingsCode = fs.readFileSync(settingsPath, 'utf8');

// 1. Extract RulesConfig interface from rewards
const rulesConfigMatch = rewardsCode.match(/interface RulesConfig \{[\s\S]*?\}/);
const rulesConfigStr = rulesConfigMatch[0];

// 2. Extract state declarations
const rulesStateMatch = rewardsCode.match(/const \[rules, setRules\] = useState<RulesConfig \| null>\(null\);/);
const policyStateMatch = rewardsCode.match(/const \[policy, setPolicy\] = useState<Partial<AttendancePolicy>>\(\{\}\);/);

// 3. Extract the saving logic for rules and policy
const handleSaveMatch = rewardsCode.match(/const handleSave = async \(\) => \{[\s\S]*?setTimeout\(\(\) => setMsg\(""\), 3000\);\n  \};/);
let handleSaveStr = handleSaveMatch[0].replace(/const handleSave = /, 'const handleSaveSchoolRules = ');

// 4. Extract the JSX block for Rules Editor
const rulesEditorMatch = rewardsCode.match(/\{\/\* Rules Editor \*\/\}\s*<div className="space-y-4">[\s\S]*?\{\/\* Audit Log \*\/\}/);
let rulesEditorStr = rulesEditorMatch[0].replace(/\s*\{\/\* Audit Log \*\/\}/, '');

// Update settings.tsx

// A. Insert imports
settingsCode = settingsCode.replace(
  /import { toast } from "sonner";/,
  `import { toast } from "sonner";\nimport type { AttendancePolicy } from "@/lib/types/database";\nimport { Clock, Wallet } from "lucide-react";`
);

// B. Insert RulesConfig interface
settingsCode = settingsCode.replace(
  /interface SchoolConfig \{/,
  `${rulesConfigStr}\n\ninterface SchoolConfig {`
);

// C. Insert states
settingsCode = settingsCode.replace(
  /const \[passwordMsg, setPasswordMsg\] = useState\(""\);/,
  `const [passwordMsg, setPasswordMsg] = useState("");\n  const [rules, setRules] = useState<RulesConfig | null>(null);\n  const [policy, setPolicy] = useState<Partial<AttendancePolicy>>({});\n  const [rulesMsg, setRulesMsg] = useState("");`
);

// D. Add fetch logic inside useEffect load function
const fetchRulesStr = `
        // Fetch rules & policy
        const [rRes, pRes] = await Promise.all([
          supabase.from("reward_rules").select("*").eq("school_id", currentSchoolId).limit(1).maybeSingle(),
          supabase.from("attendance_policies").select("*").eq("school_id", currentSchoolId).is("class_id", null).limit(1).maybeSingle(),
        ]);
        
        if (rRes.data) {
          setRules(rRes.data as RulesConfig);
        } else {
          setRules({
            id: "",
            base_reward: 5000,
            early_bonus: 2000,
            monthly_hold_bonus_pct: 5,
            attendance_start_time: "06:00",
            attendance_end_time: "09:00",
            early_cutoff_time: "07:00",
            min_withdrawal_amount: 10000,
            economy_config: {}
          });
        }
        
        if (pRes.data) {
          setPolicy(pRes.data as AttendancePolicy);
        } else {
          setPolicy({
            checkin_open_at: "06:00",
            early_start_at: "06:00",
            early_end_at: "06:45",
            normal_start_at: "06:46",
            normal_end_at: "07:00",
            late_start_at: "07:01",
            late_end_at: "08:00",
            absent_after_at: "08:00",
            late_enabled: true,
            late_grace_minutes: 5,
            late_penalty_type: "points_deduction",
            late_penalty_value: 5,
          });
        }
`;

settingsCode = settingsCode.replace(
  /setSchool\(activeSchool as SchoolConfig\);\n\s*\}/,
  `setSchool(activeSchool as SchoolConfig);\n${fetchRulesStr}\n      }`
);

// E. Add handleSaveSchoolRules
handleSaveStr = handleSaveStr.replace(/setMsg\(/g, 'setRulesMsg(').replace(/msg\./g, 'rulesMsg.').replace(/\{msg\}/g, '{rulesMsg}');
settingsCode = settingsCode.replace(
  /const handleSwitchSchool = async /,
  `${handleSaveStr}\n\n  const handleSwitchSchool = async `
);

// F. Add Rules Editor JSX
rulesEditorStr = rulesEditorStr.replace(/msg\.includes/g, 'rulesMsg.includes').replace(/\{msg\}/g, '{rulesMsg}').replace(/handleSave/g, 'handleSaveSchoolRules');

// Strip out the monthly processing block since it belongs in Rewards
rulesEditorStr = rulesEditorStr.replace(/<div className="glass rounded-2xl p-5 border border-indigo-500\/20">[\s\S]*?<\/div>/, '');

settingsCode = settingsCode.replace(
  /\{!school && \([\s\S]*?\}\)}/,
  `{!school && (
        <div className="glass rounded-2xl p-6 text-center space-y-4">
          <MapPin className="h-10 w-10 text-primary mx-auto animate-bounce" />
          <h2 className="text-lg font-bold">No School Configuration Found</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You must create a school configuration with coordinates and geofencing radius before students can check in.
          </p>
          <button
            onClick={async () => {
              setSaving(true);
              const supabase = createClient();
              const { data, error } = await supabase
                .from("schools")
                .insert({
                  name: "SMK Negeri 1 Jakarta",
                  latitude: -6.2088,
                  longitude: 106.8456,
                  radius_m: 200
                })
                .select()
                .single();
              
              if (error) {
                toast.error("Failed to create school: " + error.message);
              } else {
                setSchool(data as SchoolConfig);
                toast.success("School configuration created! Please update coordinates and details.");
              }
              setSaving(false);
            }}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Initialize School Configuration
          </button>
        </div>
      )}

      {school && (
        <div className="mt-8">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-primary"><Settings className="h-5 w-5" /> School Rules & Policies</h2>
          ${rulesEditorStr}
        </div>
      )}`
);

fs.writeFileSync(settingsPath, settingsCode);

// CLEANUP REWARDS PAGE
// 1. Remove RulesConfig interface
rewardsCode = rewardsCode.replace(rulesConfigMatch[0], '');
// 2. Remove rules, policy states
rewardsCode = rewardsCode.replace(/const \[rules, setRules\] = useState<RulesConfig \| null>\(null\);\n  /, '');
rewardsCode = rewardsCode.replace(/const \[policy, setPolicy\] = useState<Partial<AttendancePolicy>>\(\{\}\);\n  /, '');
// 3. Remove from fetch
rewardsCode = rewardsCode.replace(/const \[rRes, tRes, pRes\] = await Promise\.all\(\[[\s\S]*?\]\);/, 'const { data: tData } = await supabase.from("wallet_transactions").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(50);');
rewardsCode = rewardsCode.replace(/if \(rRes\.data\) \{[\s\S]*?\}\n        /, '');
rewardsCode = rewardsCode.replace(/if \(pRes\.data\) \{[\s\S]*?\}\n      /, '');
rewardsCode = rewardsCode.replace(/if \(tRes\.data\) setTransactions\(tRes\.data as any\[\]\);/, 'if (tData) setTransactions(tData as any[]);');
// 4. Remove handleSave
rewardsCode = rewardsCode.replace(handleSaveMatch[0], '');
// 5. Remove Rules Editor JSX
rewardsCode = rewardsCode.replace(/\{\/\* Rules Editor \*\/\}\s*<div className="space-y-4">[\s\S]*?\{\/\* Audit Log \*\/\}/, '{/* Audit Log */}');
// 6. Update grid col
rewardsCode = rewardsCode.replace(/className="grid grid-cols-1 lg:grid-cols-2 gap-6"/, 'className="grid grid-cols-1 gap-6"');

// 7. Remove unused imports
rewardsCode = rewardsCode.replace(/import type \{ WalletTransaction, AttendancePolicy \} from "@\/lib\/types\/database";/, 'import type { WalletTransaction } from "@/lib/types/database";');

fs.writeFileSync(rewardsPath, rewardsCode);

console.log("Done");
