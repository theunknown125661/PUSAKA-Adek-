export interface XPConfig {
  early?: number;
  normal?: number;
  late?: number;
  attendance_present?: number; // legacy
  attendance_ontime?: number; // legacy
  formula_type: "progressive" | "constant";
  constant_xp_per_level: number;
  progressive_base: number;
}

export function calculateLevelAndProgress(xp: number, economyConfig?: any, currentLevel?: number) {
  const xpConfig = economyConfig?.xp;
  const type = xpConfig?.formula_type || "progressive";
  
  if (type === "constant") {
    const constantXp = xpConfig?.constant_xp_per_level || 1000;
    const level = currentLevel !== undefined ? currentLevel : Math.max(1, Math.floor(xp / constantXp) + 1);
    
    const xpToCurrentLevel = (level - 1) * constantXp;
    const xpInCurrentLevel = Math.max(0, xp - xpToCurrentLevel);
    const xpForNextLevel = constantXp;
    const progressPct = Math.min((xpInCurrentLevel / xpForNextLevel) * 100, 100);
    return { level, xpInCurrentLevel, xpForNextLevel, progressPct };
  } else {
    const base = xpConfig?.progressive_base || 100;
    const level = currentLevel !== undefined ? currentLevel : Math.max(1, Math.floor(Math.sqrt(xp / base)) + 1);
    
    const xpToCurrentLevel = Math.pow(level - 1, 2) * base;
    const xpToNextLevel = Math.pow(level, 2) * base;
    const xpInCurrentLevel = Math.max(0, xp - xpToCurrentLevel);
    const xpForNextLevel = Math.max(1, xpToNextLevel - xpToCurrentLevel); // Ensure no division by zero
    const progressPct = Math.min((xpInCurrentLevel / xpForNextLevel) * 100, 100);
    return { level, xpInCurrentLevel, xpForNextLevel, progressPct };
  }
}
