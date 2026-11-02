// University Road Rider icon set: 24px grid, 1.75 stroke, round caps/joins, currentColor.
// Single source for both the DOM screens (iconSvg) and React (<Icon />).

export const ICONS = {
  // ---- currency & status ----
  coin: `<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.2a3.6 3.6 0 1 0 0 5.6"/>`,
  star: `<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  flame: `<path d="M12 21c3.6 0 6-2.4 6-5.6 0-3.9-3.5-5.6-3.9-9.9-2.6 1.5-3.6 4-3.3 6.3-1.2-.6-1.9-1.8-2-3C7.3 10.5 6 12.8 6 15.4 6 18.6 8.4 21 12 21z"/>`,
  pin: `<path d="M12 21s6.5-6 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>`,
  trophy: `<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>`,

  // ---- navigation & actions ----
  back: `<path d="M15 5l-7 7 7 7"/>`,
  next: `<path d="M9 5l7 7-7 7"/>`,
  swap: `<path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/>`,
  retry: `<path d="M19.5 12A7.5 7.5 0 1 1 17 6.4"/><path d="M19.5 4v4.5H15"/>`,
  pause: `<path d="M9 5.5v13M15 5.5v13"/>`,
  play: `<path d="M8 5.5v13l10.5-6.5z"/>`,
  home: `<path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5"/><path d="M10 19v-5h4v5"/>`,
  settings: `<path d="M10.3 3.5h3.4l.5 2.4 1.7.9 2.3-.9 1.7 2.9-1.8 1.6v2l1.8 1.6-1.7 2.9-2.3-.9-1.7.9-.5 2.4h-3.4l-.5-2.4-1.7-.9-2.3.9-1.7-2.9 1.8-1.6v-2L3.9 8.8l1.7-2.9 2.3.9 1.7-.9z"/><circle cx="12" cy="12" r="2.8"/>`,
  map: `<path d="M9 5L4 7v12l5-2 6 2 5-2V5l-5 2z"/><path d="M9 5v12M15 7v12"/>`,
  arrowLeft: `<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  arrowRight: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  arrowUp: `<path d="M12 19V5M6 11l6-6 6 6"/>`,
  arrowDown: `<path d="M12 5v14M6 13l6 6 6-6"/>`,

  // ---- vehicle & garage ----
  bike: `<circle cx="6" cy="16.5" r="3"/><circle cx="18" cy="16.5" r="3"/><path d="M6 16.5l4-6h4.5l3.5 6M9 10.5h3M14.5 10.5L13 7h2.5"/><path d="M10 16.5h4.5"/>`,
  wrench: `<path d="M14.7 5.3a4 4 0 0 0-5 5L4.5 15.5a2.1 2.1 0 0 0 3 3l5.2-5.2a4 4 0 0 0 5-5l-2.5 2.5-2.6-.4-.4-2.6z"/>`,
  shovel: `<path d="M14 10l5.5-5.5M17.5 3l3.5 3.5"/><path d="M13.5 10.5l-6.6 6.6a1 1 0 0 1-1.4 0l-2.6-2.6a1 1 0 0 1 0-1.4L9.5 6.5a3 3 0 0 1 4 4z"/>`,
  engine: `<path d="M4 10h3l1.5-2h6l1.5 2H19v6h-2.5L15 18H8l-1.5-2H4z"/><path d="M2.5 11.5v3M21.5 11.5v3M10 8V6h4v2"/>`,
  spring: `<path d="M12 3v2.5M12 18.5V21"/><path d="M7 5.5h10l-10 3h10l-10 3h10l-10 3h10l-10 3h10"/>`,
  brake: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>`,
  horn: `<circle cx="4.5" cy="12" r="2"/><path d="M6.5 12H9M9 9.5v5M9 10.5l10.5-5v13L9 13.5"/><path d="M19.5 8.5c1 .9 1.5 2.1 1.5 3.5s-.5 2.6-1.5 3.5"/>`,
  helmet: `<path d="M4 15a8 8 0 0 1 16 0v2H4z"/><path d="M12 7v4.5h8M4 17h16"/>`,
  magnet: `<path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"/><path d="M6 8h4M14 8h4"/>`,
  chai: `<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H15M8 3.5c-.8 1 .8 2 0 3M11 3.5c-.8 1 .8 2 0 3"/>`,
  paint: `<path d="M5 4h11v5H5z"/><path d="M16 6.5h3v4.5h-8.5V14"/><path d="M9 14h3v6.5H9z"/>`,

  // ---- road problems ----
  pothole: `<path d="M3 17h18"/><path d="M6.5 17c.6-2.4 2.4-3.5 5.5-3.5s4.9 1.1 5.5 3.5"/><path d="M9 13.5l-1-2.5M15 13.5l1.2-2.2M12 13.5V10"/>`,
  manhole: `<ellipse cx="12" cy="14" rx="8.5" ry="4.5"/><path d="M12 13.5V3.5M12 6l3-2M12 8.5L9 6.5"/>`,
  gutter: `<path d="M3 15c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2"/><path d="M3 19c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2"/><path d="M12 4c2 2.6 3 4.3 3 5.6a3 3 0 0 1-6 0C9 8.3 10 6.6 12 4z"/>`,
  breaker: `<path d="M2.5 18h19"/><path d="M5 18c1.3-3.6 3.6-5.5 7-5.5s5.7 1.9 7 5.5"/><path d="M8.5 14l1 2.5M12 12.5V16M15.5 14l-1 2.5"/>`,
  barrier: `<path d="M3.5 8.5h17v5h-17z"/><path d="M7 8.5l-3.5 5M12.5 8.5l-3.5 5M18 8.5l-3.5 5M20.5 10.5l-2 3"/><path d="M6 13.5V20M18 13.5V20M6 8.5V5M18 8.5V5"/>`,
  crossing: `<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2.5-6 2.5 2v4M12.5 15l.5-5.5 3 3 3 .5M13 9.5l-3.5 1.5-1.5 3"/>`,
  cattle: `<path d="M5 9h11.5a3 3 0 0 1 3 3v1.5h-1.5V18h-2v-3H8v3H6v-4.5a3 3 0 0 1-1-2z"/><path d="M5 9L3 6.5M5 9l-1.5 3.5H6"/><path d="M19.5 13.5L21 16"/>`,
  traffic: `<rect x="8" y="2.5" width="8" height="19" rx="3"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>`,
  bus: `<rect x="4.5" y="3.5" width="15" height="15" rx="2.5"/><path d="M4.5 12h15M8 18.5v2M16 18.5v2M7.5 15.5h1M15.5 15.5h1M4.5 7.5h15"/>`,
  wrongway: `<circle cx="12" cy="12" r="8.5"/><path d="M7 12h10"/>`,
  dust: `<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>`,

  // ---- time & weather ----
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
  dusk: `<path d="M3 18h18M5.5 21h13"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 4.5v3M4.6 9.6l2 2M19.4 9.6l-2 2"/>`,
  moon: `<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>`,
  clear: `<circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M2.5 9H4M4.4 4.4l1 1M13.6 4.4l-1 1"/><path d="M8 19.5h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.8A2.7 2.7 0 0 0 8 19.5z"/>`,
  rain: `<path d="M7 15.5h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.6A2.8 2.8 0 0 0 7 15.5z"/><path d="M8 18.5l-1 2.5M12 18.5l-1 2.5M16 18.5l-1 2.5"/>`,
} as const;

export type IconName = keyof typeof ICONS;

/** SVG markup for the DOM screens. */
export function iconSvg(name: IconName, size = 22, extraClass = "") {
  return `<svg class="ico ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}
