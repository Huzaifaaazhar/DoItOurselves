import { FIXES, PLACES } from "./data/route";

export type UpgradeId = "engine" | "suspension" | "brakes" | "horn" | "helmet" | "magnet";
export interface Upgrade { id: UpgradeId; name: string; desc: string; icon: string; max: number; base: number }
export const UPGRADES: Upgrade[] = [
  { id: "engine", name: "Engine tuning", desc: "Higher top speed", icon: "⚙️", max: 5, base: 60 },
  { id: "suspension", name: "Shocks", desc: "Less damage from potholes & breakers", icon: "🛞", max: 5, base: 50 },
  { id: "brakes", name: "Brakes", desc: "Stop faster", icon: "🛑", max: 5, base: 40 },
  { id: "horn", name: "Pressure horn", desc: "People & cattle clear out from further away", icon: "📯", max: 5, base: 35 },
  { id: "helmet", name: "Helmet & guards", desc: "More health per ride", icon: "⛑️", max: 5, base: 70 },
  { id: "magnet", name: "Coin magnet", desc: "Magnet power-ups last longer", icon: "🧲", max: 5, base: 45 },
];
export const upgradeCost = (u: Upgrade, level: number) => Math.round(u.base * Math.pow(1.7, level));

export interface Paint { id: string; name: string; tank: string; cost: number }
export const PAINTS: Paint[] = [
  { id: "classic", name: "Classic Red", tank: "#d62828", cost: 0 },
  { id: "black", name: "Midnight Black", tank: "#1c1c1f", cost: 80 },
  { id: "blue", name: "Gulshan Blue", tank: "#1f6feb", cost: 80 },
  { id: "green", name: "Pakistan Green", tank: "#11823b", cost: 120 },
  { id: "gold", name: "Sone ki Chirya", tank: "#d4a017", cost: 250 },
];

export interface SaveData {
  coins: number;
  fixes: Record<number, Record<string, true>>;
  upgrades: Record<UpgradeId, number>;
  paints: string[];
  paint: string;
  settings: { sound: boolean; music: boolean; haptics: boolean; quality: "high" | "low" };
  stats: { rides: number; arrivals: number; distance: number; coins: number; best: number };
  tutorialDone: boolean;
}

const KEY = "urr-save-v2";
const fresh = (): SaveData => ({
  coins: 0, fixes: {},
  upgrades: { engine: 0, suspension: 0, brakes: 0, horn: 0, helmet: 0, magnet: 0 },
  paints: ["classic"], paint: "classic",
  settings: { sound: true, music: true, haptics: true, quality: "high" },
  stats: { rides: 0, arrivals: 0, distance: 0, coins: 0, best: 0 },
  tutorialDone: false,
});

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = fresh(); const s = JSON.parse(raw); return { ...d, ...s, settings: { ...d.settings, ...s.settings }, upgrades: { ...d.upgrades, ...s.upgrades }, stats: { ...d.stats, ...s.stats } }; }
  } catch { /* storage unavailable */ }
  return fresh();
}

export const save: SaveData = load();
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

export const isFixed = (section: number, fixId: string) => !!save.fixes[section]?.[fixId];
export function applyFix(section: number, fixId: string) { (save.fixes[section] ??= {})[fixId] = true; persist(); }
export function sectionFixedPct(section: number) { return Object.keys(save.fixes[section] ?? {}).length / FIXES.length; }
export function roadFixedPct() {
  let n = 0; for (let i = 0; i < PLACES.length - 1; i++) n += sectionFixedPct(i);
  return n / (PLACES.length - 1);
}
