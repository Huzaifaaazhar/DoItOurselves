// University Road, Karachi: Hassan Square → Safoora Chowrangi.
//
// `km` is the approximate real distance from Hassan Square along the road.
// The game compresses distances by GAME_SCALE so a full ride lasts a few minutes.
// Edit this file to correct positions or add places; everything else reads from it.

export type Hazard =
  | "pothole" | "manhole" | "gutter" | "breaker" | "barrier" | "sand"
  | "walker" | "cattle" | "car" | "rickshaw" | "qingqi" | "bus" | "tanker" | "wrongway";

export type LandmarkKind = "chowrangi" | "university" | "building" | "park" | "stop";

export interface Place {
  id: string;
  name: string;
  urdu: string;
  km: number;
  kind: LandmarkKind;
  lat: number;
  lng: number;
  /** Stop the player can choose as a start or destination. */
  stop: boolean;
}

export const GAME_SCALE = 600; // game metres per real km

export const PLACES: Place[] = [
  { id: "hassan", name: "Hassan Square", urdu: "حسن اسکوائر", km: 0, kind: "chowrangi", lat: 24.9042, lng: 67.0771, stop: true },
  { id: "civic", name: "Civic Centre", urdu: "سوک سینٹر", km: 0.4, kind: "building", lat: 24.9064, lng: 67.0802, stop: true },
  { id: "expo", name: "Expo Centre", urdu: "ایکسپو سینٹر", km: 0.9, kind: "building", lat: 24.9089, lng: 67.0841, stop: false },
  { id: "urdu", name: "Federal Urdu University", urdu: "اردو یونیورسٹی", km: 1.6, kind: "university", lat: 24.9118, lng: 67.0898, stop: true },
  { id: "ssuet", name: "Sir Syed University", urdu: "سر سید یونیورسٹی", km: 2.0, kind: "university", lat: 24.9137, lng: 67.0929, stop: false },
  { id: "safari", name: "Safari Park", urdu: "سفاری پارک", km: 2.6, kind: "park", lat: 24.9160, lng: 67.0985, stop: true },
  { id: "nipa", name: "NIPA Chowrangi", urdu: "نیپا چورنگی", km: 3.4, kind: "chowrangi", lat: 24.9178, lng: 67.0970, stop: true },
  { id: "maskan", name: "Maskan Chowrangi", urdu: "مسکن چورنگی", km: 4.4, kind: "chowrangi", lat: 24.9262, lng: 67.1040, stop: true },
  { id: "ku", name: "Karachi University", urdu: "جامعہ کراچی", km: 5.2, kind: "university", lat: 24.9300, lng: 67.1105, stop: true },
  { id: "ned", name: "NED University", urdu: "این ای ڈی یونیورسٹی", km: 6.0, kind: "university", lat: 24.9330, lng: 67.1150, stop: true },
  { id: "ojha", name: "Dow University Ojha Campus", urdu: "اوجھا کیمپس", km: 7.0, kind: "university", lat: 24.9390, lng: 67.1270, stop: false },
  { id: "safoora", name: "Safoora Chowrangi", urdu: "صفورا چورنگی", km: 8.3, kind: "chowrangi", lat: 24.9440, lng: 67.1400, stop: true },
];

/**
 * How common each hazard is on each stretch (section i runs from PLACES[i] to PLACES[i+1]).
 * Weights reflect what's reported on the road: heavy BRT Red Line construction and dust past NIPA,
 * sewage overflow near Hassan Square and Urdu University, students crossing near the campuses.
 */
const BASE: Record<Hazard, number> = {
  pothole: 3, manhole: 1, gutter: 1, breaker: 1, barrier: 1, sand: 1,
  walker: 1, cattle: 0.3, car: 2, rickshaw: 2, qingqi: 1, bus: 1, tanker: 0.5, wrongway: 0.5,
};
const SECTION_BOOST: Partial<Record<Hazard, number>>[] = [
  { car: 3, bus: 2, gutter: 2 },                        // Hassan Square → Civic Centre
  { car: 2, gutter: 2, rickshaw: 1 },                   // Civic Centre → Expo Centre
  { gutter: 4, manhole: 2, walker: 2 },                 // Expo Centre → Urdu University
  { walker: 4, breaker: 3, qingqi: 1 },                 // Urdu University → Sir Syed
  { walker: 2, breaker: 2, rickshaw: 2 },               // Sir Syed → Safari Park
  { car: 2, rickshaw: 3, bus: 2, wrongway: 1 },         // Safari Park → NIPA
  { barrier: 4, sand: 3, pothole: 3, tanker: 1 },       // NIPA → Maskan (BRT works)
  { walker: 3, breaker: 2, qingqi: 2, barrier: 2 },     // Maskan → Karachi University
  { walker: 3, breaker: 2, barrier: 2, pothole: 2 },    // Karachi University → NED
  { barrier: 4, sand: 3, pothole: 4, tanker: 2, cattle: 1 }, // NED → Ojha
  { barrier: 3, sand: 4, pothole: 4, cattle: 2, wrongway: 2, tanker: 2 }, // Ojha → Safoora
];
/** Chance per spawn that you ride into a dust storm on each stretch. */
export const DUST_CHANCE = [0, 0, 0.01, 0.01, 0.01, 0.01, 0.04, 0.03, 0.03, 0.05, 0.06];

export function hazardWeights(section: number): Record<Hazard, number> {
  const w = { ...BASE };
  for (const [k, v] of Object.entries(SECTION_BOOST[section] ?? {})) w[k as Hazard] += v!;
  return w;
}

export const placeDist = (p: Place) => p.km * GAME_SCALE;
export const TOTAL_DIST = placeDist(PLACES[PLACES.length - 1]);

export function sectionAt(d: number): number {
  for (let i = PLACES.length - 2; i >= 0; i--) if (d >= placeDist(PLACES[i])) return i;
  return 0;
}
export const sectionName = (i: number) => `${PLACES[i].name} → ${PLACES[i + 1].name}`;

/** Fixes the player can buy, and which hazards each one removes from a stretch. */
export interface Fix { id: string; name: string; problem: string; cost: number; removes: (Hazard | "dust")[]; icon: string }
export const FIXES: Fix[] = [
  { id: "potholes", name: "Resurface the road", problem: "Potholes", cost: 40, removes: ["pothole"], icon: "🕳️" },
  { id: "manholes", name: "Cover open manholes", problem: "Open manholes", cost: 35, removes: ["manhole"], icon: "⚫" },
  { id: "sewage", name: "Repair the sewer line", problem: "Gutter ka paani", cost: 60, removes: ["gutter"], icon: "🤢" },
  { id: "breakers", name: "Remove illegal speed breakers", problem: "Speed breakers", cost: 45, removes: ["breaker"], icon: "〰️" },
  { id: "construction", name: "Finish the BRT works", problem: "Construction blockage", cost: 90, removes: ["barrier", "sand"], icon: "🚧" },
  { id: "crossing", name: "Build a pedestrian bridge", problem: "People crossing", cost: 55, removes: ["walker"], icon: "🚶" },
  { id: "cattle", name: "Clear stray cattle", problem: "Cows on the road", cost: 30, removes: ["cattle"], icon: "🐄" },
  { id: "traffic", name: "Deploy traffic police", problem: "Lane cutters & sudden brakers", cost: 80, removes: ["car", "rickshaw", "qingqi", "tanker"], icon: "👮" },
  { id: "busstop", name: "Build proper bus bays", problem: "Buses stopping mid-road", cost: 50, removes: ["bus"], icon: "🚌" },
  { id: "oneway", name: "Challan wrong-way riders", problem: "Wrong-way traffic", cost: 40, removes: ["wrongway"], icon: "⛔" },
  { id: "dust", name: "Water and pave the dirt", problem: "Dust storms", cost: 60, removes: ["dust"], icon: "🌪️" },
];
export const fixFor = (h: Hazard | "dust") => FIXES.find(f => f.removes.includes(h))!;
