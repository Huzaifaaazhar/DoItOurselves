import { PLACES, FIXES, sectionName, fixFor, Hazard } from "../data/route";
import { save, persist, isFixed, applyFix, sectionFixedPct, roadFixedPct, UPGRADES, upgradeCost, PAINTS } from "../state";
import { Game, RideResult, TimeOfDay, Weather, HudState } from "../game/Game";
import { audio } from "../game/audio";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const LAYERS = ["home", "plan", "garage", "fix", "settings", "pause", "result", "tutorial"];
function show(id: string | null) {
  for (const l of LAYERS) $(l).classList.toggle("on", l === id);
  $("hud").classList.toggle("on", id === null);
}
const coinPill = () => `<span class="pill coin-pill">🪙 ${save.coins}</span>`;

export class UI {
  sel = { from: 0, to: PLACES.findIndex(p => p.id === "ku"), time: "day" as TimeOfDay, weather: "clear" as Weather };
  fixSection = 0;
  lastResult: RideResult | null = null;

  constructor(private game: Game) {
    game.onHud = s => this.hud(s);
    game.onToast = (m, tone) => this.toast(m, tone);
    game.onEnd = r => setTimeout(() => this.result(r), r.arrived ? 1800 : 600);
    game.onBanner = (t, k) => this.banner(t, k);
    const unlock = () => audio.unlock();
    addEventListener("pointerdown", unlock); addEventListener("keydown", unlock);
    this.bindControls();
    this.home();
  }

  private bannerTimer = 0;
  banner(text: string, kind: "goal" | "warn" | "swerve-left" | "swerve-right" | "info") {
    const b = $("banner");
    const arrow = kind === "swerve-left" ? "⬅ " : kind === "swerve-right" ? "" : "";
    const arrowR = kind === "swerve-right" ? " ➡" : "";
    b.innerHTML = `<span>${arrow}${text}${arrowR}</span>`;
    b.className = `show ${kind.startsWith("swerve") ? "swerve" : kind}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.className = "", kind === "goal" ? 2600 : 1700);
  }

  // ---------- home ----------
  home() {
    this.game.reset();
    const pct = Math.round(roadFixedPct() * 100);
    $("home").innerHTML = `<div class="wrap">
      <div class="row">${coinPill()}<div class="spacer"></div><button class="icon-btn" data-go="settings" aria-label="Settings">⚙️</button></div>
      <div class="logo"><div class="kicker">KARACHI · کراچی</div><h1>University<br><span>Road Rider</span></h1><div class="urdu">یونیورسٹی روڈ</div></div>
      <div class="spacer"></div>
      <div class="card">
        <div class="row"><b>Road repaired</b><div class="spacer"></div><b>${pct}%</b></div>
        <div class="meter" style="margin-top:8px"><i style="width:${Math.max(3, pct)}%"></i></div>
        <div class="stats3" style="margin-top:12px">
          <div class="stat"><b>${save.stats.arrivals}</b><small>Trips made</small></div>
          <div class="stat"><b>${(save.stats.distance / 1000).toFixed(1)}</b><small>km ridden</small></div>
          <div class="stat"><b>${save.stats.best}</b><small>Best coins</small></div>
        </div>
      </div>
      <button class="btn primary" data-go="plan">🏍️ Ride</button>
      <div class="grid2"><button class="btn" data-go="garage">🔧 Garage</button><button class="btn" data-go="fix">🛠️ Fix the road</button></div>
    </div>`;
    this.wire($("home")); show("home");
  }
  private wire(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>("[data-go]").forEach(b => b.onclick = () => {
      const go = b.dataset.go!;
      if (go === "home") this.home(); else if (go === "plan") this.plan(); else if (go === "garage") this.garage();
      else if (go === "fix") this.fix(); else if (go === "settings") this.settings();
    });
  }

  // ---------- route map from real coordinates ----------
  private mapSvg(opts: { from?: number; to?: number; sections?: boolean; selSection?: number }) {
    return this.mapSvgInner(opts).replace('<div class="map">', '<div class="map light">').replace("<svg ", `<svg ${MAP_DEFS}`);
  }
  private mapSvgInner(opts: { from?: number; to?: number; sections?: boolean; selSection?: number }) {
    const lats = PLACES.map(p => p.lat), lngs = PLACES.map(p => p.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const W = 400, H = 320, padX = 95, padY = 40;
    const sx = (W - padX * 2) / (maxLng - minLng), sy = (H - padY * 2) / (maxLat - minLat), s = Math.min(sx, sy);
    const ox = (W - (maxLng - minLng) * s) / 2, oy = (H - (maxLat - minLat) * s) / 2;
    const pt = (i: number) => [ox + (PLACES[i].lng - minLng) * s, H - oy - (PLACES[i].lat - minLat) * s] as const;
    const path = PLACES.map((_, i) => pt(i).join(",")).join(" ");
    let segs = "";
    for (let i = 0; i < PLACES.length - 1; i++) {
      const p = sectionFixedPct(i), [a, b] = [pt(i), pt(i + 1)];
      const col = opts.sections ? `hsl(${p * 130}, 75%, 45%)` : "#34a853";
      const w = opts.selSection === i ? 10 : 6;
      segs += `<line class="road-in" data-sec="${i}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width="${w}" />`;
    }
    let trip = "";
    if (opts.from !== undefined && opts.to !== undefined && opts.from !== opts.to) {
      const [lo, hi] = [Math.min(opts.from, opts.to), Math.max(opts.from, opts.to)];
      trip = `<polyline class="trip" points="${PLACES.slice(lo, hi + 1).map((_, k) => pt(lo + k).join(",")).join(" ")}" />`;
    }
    const stops = PLACES.map((p, i) => {
      const [x, y] = pt(i), cls = i === opts.from ? "from" : i === opts.to ? "to" : p.stop ? "" : "minor";
      const left = i % 2 === 0;
      return `<g class="stop ${cls}" data-i="${i}"><circle cx="${x}" cy="${y}" r="${p.stop ? 8 : 5}" /><text x="${x + (left ? -12 : 12)}" y="${y + 4}" text-anchor="${left ? "end" : "start"}">${p.name.replace(" University", " Uni").replace(" Chowrangi", "")}</text></g>`;
    }).join("");
    return `<div class="map"><svg viewBox="0 0 ${W} ${H}"><polyline class="road" points="${path}" />${segs}${trip}${stops}</svg><div class="tag">University Road · Hassan Square ⟶ Safoora</div></div>`;
  }

  // ---------- ride planner ----------
  plan() {
    const stops = PLACES.map((p, i) => ({ p, i })).filter(s => s.p.stop);
    const opt = (sel: number) => stops.map(s => `<option value="${s.i}" ${s.i === sel ? "selected" : ""}>${s.p.name}</option>`).join("");
    const chip = (group: string, val: string, label: string, on: boolean) => `<button class="chip ${on ? "on" : ""}" data-${group}="${val}">${label}</button>`;
    $("plan").innerHTML = `<div class="wrap">
      <div class="topbar"><button class="icon-btn" data-go="home">←</button><h2>Plan your ride</h2><div class="spacer"></div>${coinPill()}</div>
      ${this.mapSvg({ from: this.sel.from, to: this.sel.to })}
      <div class="card">
        <div class="label">Route · tap the map or choose</div>
        <div class="trip-row"><select id="selFrom">${opt(this.sel.from)}</select><button class="icon-btn" id="swap">⇄</button><select id="selTo">${opt(this.sel.to)}</select></div>
        <div class="muted" style="margin-top:10px;font-size:13px" id="tripInfo"></div>
      </div>
      <div class="card">
        <div class="label">Time of day</div>
        <div class="chips">${chip("time", "day", "☀️ Day", this.sel.time === "day")}${chip("time", "evening", "🌇 Evening rush", this.sel.time === "evening")}${chip("time", "night", "🌙 Night", this.sel.time === "night")}</div>
        <div class="label" style="margin-top:14px">Weather</div>
        <div class="chips">${chip("weather", "clear", "🌤️ Clear", this.sel.weather === "clear")}${chip("weather", "dusty", "🌪️ Dusty", this.sel.weather === "dusty")}${chip("weather", "rain", "🌧️ Monsoon", this.sel.weather === "rain")}</div>
      </div>
      <div class="card light-card">
        <div class="label" style="color:#5f6368">Road condition</div>
        <div class="rider-opt"><span class="rider-ic">🏍️</span><div style="flex:1"><b>CD70 rider</b><small>${tripCondition(this.sel.from, this.sel.to)}</small></div><span class="radio on"></span></div>
      </div>
      <div class="grid2"><button class="btn map-btn" data-go="fix">Map</button><button class="btn primary select-btn" id="startRide">Select</button></div>
    </div>`;
    const root = $("plan"); this.wire(root);
    const km = Math.abs(PLACES[this.sel.to].km - PLACES[this.sel.from].km);
    $("tripInfo").textContent = this.sel.from === this.sel.to ? "Pick two different places." : `${km.toFixed(1)} km on the real road · bonus coins for evening rush, night and bad weather`;
    $<HTMLSelectElement>("selFrom").onchange = e => { this.sel.from = +(e.target as HTMLSelectElement).value; this.plan(); };
    $<HTMLSelectElement>("selTo").onchange = e => { this.sel.to = +(e.target as HTMLSelectElement).value; this.plan(); };
    $("swap").onclick = () => { [this.sel.from, this.sel.to] = [this.sel.to, this.sel.from]; this.plan(); };
    root.querySelectorAll<SVGGElement>(".stop").forEach(g => g.addEventListener("click", () => {
      const i = +g.dataset.i!; if (!PLACES[i].stop) return;
      if (i !== this.sel.from) this.sel.to = i; this.plan();
    }));
    root.querySelectorAll<HTMLElement>("[data-time]").forEach(b => b.onclick = () => { this.sel.time = b.dataset.time as TimeOfDay; this.plan(); });
    root.querySelectorAll<HTMLElement>("[data-weather]").forEach(b => b.onclick = () => { this.sel.weather = b.dataset.weather as Weather; this.plan(); });
    $<HTMLButtonElement>("startRide").disabled = this.sel.from === this.sel.to;
    $("startRide").onclick = () => this.startRide();
    show("plan");
  }

  startRide() {
    if (!save.tutorialDone) return this.tutorial();
    this.game.start({ ...this.sel });
    save.stats.rides++; persist();
    show(null);
  }

  tutorial() {
    $("tutorial").innerHTML = `<div class="wrap"><div class="spacer"></div>
      <div class="card"><h2 style="margin-bottom:6px">How to ride</h2><p class="muted" style="margin:0 0 14px">Reach your stop on University Road, grab coins, and spend them to fix the road for everyone.</p>
      <div class="tut">
        <div><b>👈 👉</b>Swipe to change lane</div>
        <div><b>👆</b>Swipe up to jump potholes, gutters &amp; breakers</div>
        <div><b>👇</b>Hold a swipe down to brake</div>
        <div><b>📯</b>Horn moves people &amp; cows out of the way</div>
      </div>
      <p class="muted" style="font-size:13px;margin:14px 0 0">Keyboard: ← → / A D lanes · ↑ / Space jump · ↓ / S brake · H horn · Esc pause</p></div>
      <button class="btn primary" id="tutGo">Let's go!</button><div class="spacer"></div></div>`;
    $("tutGo").onclick = () => { save.tutorialDone = true; persist(); this.startRide(); };
    show("tutorial");
  }

  // ---------- HUD ----------
  private hudBuilt = false;
  hud(s: HudState) {
    if (!this.hudBuilt) {
      $("hud").innerHTML = `
        <div class="hud-coin-badge">C</div>
        <div class="hud-tags">
          <span class="tag-box" id="tagDist">Distance: 0km</span>
          <span class="tag-box" id="tagCoins">Coins: 0</span>
          <span class="tag-box status" id="tagStatus"></span>
        </div>
        <button class="icon-btn" id="pauseBtn" aria-label="Pause">⏸</button>
        <div class="hud-health"><i id="hpFill"></i></div>
        <div class="next-strip"><span id="nextName"></span><div class="route"><i id="routeFill"></i><b id="routeDot"></b></div></div>
        <div class="powers" id="powers"></div>
        <div class="speedo"><b id="spd">0</b><small>km/h</small></div>
        <button id="hornBtn" aria-label="Horn">📯</button>`;
      $("pauseBtn").onclick = () => this.pause();
      $("hornBtn").addEventListener("pointerdown", e => { e.stopPropagation(); this.game.horn(); });
      this.hudBuilt = true;
    }
    const r = s.hp / s.maxHp;
    const fill = $("hpFill"); fill.style.width = Math.max(0, r * 100) + "%"; fill.style.background = r > 0.5 ? "var(--good)" : r > 0.25 ? "var(--accent-2)" : "var(--bad)";
    $("tagDist").textContent = `Distance: ${(s.remaining / 600).toFixed(1)}km`;
    $("tagCoins").textContent = `Coins: ${s.coins}`;
    const st = $("tagStatus"); st.textContent = s.status; st.style.display = s.status ? "" : "none";
    st.classList.toggle("ok", s.status === "Road is smooth");
    $("nextName").textContent = `📍 ${s.next.replace(" Chowrangi", "")} · ${Math.round(s.nextDist / 600 * 1000)} m`;
    $("routeFill").style.width = s.progress * 100 + "%"; $("routeDot").style.left = s.progress * 100 + "%";
    $("spd").textContent = String(Math.round(s.speed));
    $("powers").innerHTML = (s.magnet > 0 ? `<span>🧲 ${Math.ceil(s.magnet)}s</span>` : "") + (s.shield > 0 ? `<span>⛑️ ${Math.ceil(s.shield)}s</span>` : "") + (s.combo >= 10 ? `<span>🔥 x${s.combo}</span>` : "");
  }
  private toastTimer = 0;
  toast(msg: string, tone: "bad" | "good" | "info" = "bad") {
    const t = $("toast"); t.textContent = msg; t.className = `show ${tone}`;
    clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => t.className = "", 1600);
    if (tone === "bad") { $("flash").classList.add("hit"); setTimeout(() => $("flash").classList.remove("hit"), 60); }
  }

  pause() {
    if (!this.game.running) return;
    this.game.paused = true; audio.stopEngine();
    $("pause").innerHTML = `<div class="wrap"><div class="spacer"></div><div class="card" style="text-align:center"><h2>Paused</h2><p class="muted">Heading to ${this.game.dest.name}</p>
      <div style="display:flex;flex-direction:column;gap:10px"><button class="btn primary" id="resume">▶ Resume</button><button class="btn" id="quit">Quit ride</button></div></div><div class="spacer"></div></div>`;
    $("resume").onclick = () => { this.game.paused = false; audio.startEngine(); show(null); };
    $("quit").onclick = () => { this.game.paused = false; this.game.running = false; audio.stopEngine(); this.home(); };
    show("pause");
  }

  // ---------- results ----------
  result(r: RideResult) {
    this.lastResult = r;
    const mult = (this.sel.time === "day" ? 1 : 1.25) * (this.sel.weather === "clear" ? 1 : 1.25);
    const total = Math.round((r.coins + r.bonus) * (r.arrived ? mult : 1));
    save.coins += total; save.stats.distance += r.distance; save.stats.coins += total;
    if (r.arrived) save.stats.arrivals++;
    save.stats.best = Math.max(save.stats.best, r.coins);
    persist();
    const stars = r.arrived ? (r.hp / this.game.maxHp > 0.7 ? 3 : r.hp / this.game.maxHp > 0.35 ? 2 : 1) : 0;
    const worst = (Object.entries(r.hits) as [Hazard | "dust", number][]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $("result").innerHTML = `<div class="wrap">
      <div class="result-top"><div class="hud-coin-badge static">C</div>
        <span class="goal-ribbon ${r.arrived ? "" : "bad"}">${r.arrived ? "GOAL REACHED!" : "BIKE KHARAB!"}</span>
        <span class="tag-box big">TOTAL COINS: ${total}</span></div>
      <div class="spacer" style="min-height:22vh"></div>
      <div class="card">
        <div class="row" style="margin-bottom:6px"><div><b style="font-size:18px">${r.arrived ? `Pohanch gaye! ${r.dest.name}` : `Broke down before ${r.dest.name}`}</b><div class="muted" style="font-size:13px">${r.arrived ? "You made it through University Road" : "Half your coins are saved"}</div></div><div class="spacer"></div>
        <div class="stars">${"★".repeat(stars)}<span style="opacity:.25">${"★".repeat(3 - stars)}</span></div></div>
        <div class="kv"><span>Coins collected</span><span>🪙 ${r.coins}</span></div>
        ${r.arrived ? `<div class="kv"><span>Arrival &amp; health bonus</span><span>+${r.bonus}</span></div>` : ""}
        ${r.arrived && mult > 1 ? `<div class="kv"><span>Tough conditions</span><span>×${mult.toFixed(2)}</span></div>` : ""}
        <div class="kv"><span>Total earned</span><span style="color:var(--accent-2)">🪙 ${total}</span></div>
        <div class="kv"><span>Time</span><span>${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, "0")}</span></div>
      </div>
      ${worst.length ? `<div class="card"><div class="label">What hurt you most</div>${worst.map(([k, n]) => { const f = fixFor(k); return `<div class="kv"><span>${f.icon} ${f.problem}</span><span>×${n}</span></div>`; }).join("")}</div>` : ""}
      <button class="btn primary" id="toFix">🛠️ Road Upgrade</button>
      <div class="grid2"><button class="btn" id="again">↻ Ride again</button><button class="btn" data-go="home">Home</button></div>
    </div>`;
    this.wire($("result"));
    $("toFix").onclick = () => { this.fixSection = r.sections[0] ?? 0; this.fix(); };
    $("again").onclick = () => this.startRide();
    show("result");
  }

  // ---------- fix the road ----------
  fix() {
    const s = this.fixSection;
    const recent = this.lastResult;
    const open = FIXES.filter(f => !isFixed(s, f.id)), done = FIXES.filter(f => isFixed(s, f.id));
    const hitHere = (f: (typeof FIXES)[number]) => !!(recent && recent.sections.includes(s) && f.removes.some(k => recent.hits[k]));
    // problems that hurt you last ride come first, like the mockup's "Current Condition"
    open.sort((a, b) => Number(hitHere(b)) - Number(hitHere(a)));
    const cond = open.slice(0, 5).map(f => `<div class="cond ${hitHere(f) ? "hot" : ""}"><span>${f.icon}</span><small>${f.problem.split(" ")[0]}</small></div>`).join("");
    const btns = open.map(f => `<button class="fix-btn" data-fix="${f.id}" ${save.coins < f.cost ? "disabled" : ""}>${shortFix(f.id)}<small>(${f.cost} C)</small></button>`).join("");
    const allCost = open.reduce((a, f) => a + f.cost, 0);
    const secs = PLACES.slice(0, -1).map((_, i) => `<button class="sec ${i === s ? "on" : ""}" data-sec="${i}"><span style="flex:1">${sectionName(i)}</span><span class="pct" style="color:hsl(${sectionFixedPct(i) * 130},80%,60%)">${Math.round(sectionFixedPct(i) * 100)}%</span></button>`).join("");
    $("fix").innerHTML = `<div class="wrap">
      <div class="topbar"><button class="icon-btn" data-go="home">←</button><h2>Road Upgrade</h2><div class="spacer"></div>${coinPill()}</div>
      <div class="upgrade-card">
        <div class="upgrade-title">ROAD UPGRADE</div>
        ${this.mapSvg({ sections: true, selSection: s })}
        <div class="upgrade-sec">${sectionName(s)}</div>
        ${open.length ? `<div class="label dark">Current Condition</div><div class="conds">${cond}</div>
        <div class="fix-grid">${btns}</div>
        <button class="pave-btn" id="paveAll" ${save.coins < allCost ? "disabled" : ""}>Paving ${PLACES[s].name.split(" ")[0]} Segment <small>(${allCost} C)</small></button>`
        : `<div class="all-fixed">✅ This stretch is fully repaired. Ride it to see the improved road and the finished Red Line.</div>`}
        ${done.length ? `<div class="label dark" style="margin-top:12px">Already fixed</div><div class="done-list">${done.map(f => `<span>${f.icon} ${f.problem}</span>`).join("")}</div>` : ""}
      </div>
      <div class="card"><div class="label">Choose a stretch</div><div class="sec-list">${secs}</div></div>
    </div>`;
    const root = $("fix"); this.wire(root);
    root.querySelectorAll<HTMLElement>("[data-sec]").forEach(b => b.addEventListener("click", () => { this.fixSection = +b.dataset.sec!; this.fix(); }));
    root.querySelectorAll<HTMLElement>("[data-fix]").forEach(b => b.onclick = () => {
      const f = FIXES.find(x => x.id === b.dataset.fix)!;
      if (save.coins < f.cost) return;
      save.coins -= f.cost; applyFix(s, f.id); audio.powerup(); this.toast(`${f.name}: done! ✅`, "good"); this.fix();
    });
    $("paveAll")?.addEventListener("click", () => {
      if (save.coins < allCost) return;
      save.coins -= allCost; open.forEach(f => applyFix(s, f.id)); audio.win(); this.toast("Stretch fully repaired! 🎉", "good"); this.fix();
    });
    show("fix");
  }

  // ---------- garage ----------
  garage() {
    const ups = UPGRADES.map(u => {
      const lvl = save.upgrades[u.id], max = lvl >= u.max, cost = upgradeCost(u, lvl);
      return `<div class="item"><div class="ic">${u.icon}</div><div class="tx"><b>${u.name}</b><small>${u.desc}</small><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</div></div>
        ${max ? `<span class="done">MAX</span>` : `<button class="buy" data-up="${u.id}" ${save.coins < cost ? "disabled" : ""}>🪙 ${cost}</button>`}</div>`;
    }).join("");
    const paints = PAINTS.map(p => {
      const owned = save.paints.includes(p.id);
      return `<button class="swatch ${save.paint === p.id ? "on" : ""}" data-paint="${p.id}" style="background:none"><i style="background:${p.tank}"></i>${owned ? p.name : `🪙 ${p.cost}`}</button>`;
    }).join("");
    $("garage").innerHTML = `<div class="wrap">
      <div class="topbar"><button class="icon-btn" data-go="home">←</button><h2>Garage · CD70</h2><div class="spacer"></div>${coinPill()}</div>
      <div class="card"><div class="label">Paint</div><div class="swatches">${paints}</div></div>
      <div class="card"><div class="label">Upgrades</div><div style="display:flex;flex-direction:column;gap:8px">${ups}</div></div>
    </div>`;
    const root = $("garage"); this.wire(root);
    root.querySelectorAll<HTMLElement>("[data-up]").forEach(b => b.onclick = () => {
      const u = UPGRADES.find(x => x.id === b.dataset.up)!, cost = upgradeCost(u, save.upgrades[u.id]);
      if (save.coins < cost) return;
      save.coins -= cost; save.upgrades[u.id]++; persist(); audio.powerup(); this.garage();
    });
    root.querySelectorAll<HTMLElement>("[data-paint]").forEach(b => b.onclick = () => {
      const p = PAINTS.find(x => x.id === b.dataset.paint)!;
      if (!save.paints.includes(p.id)) { if (save.coins < p.cost) return this.toast("Not enough coins", "info"); save.coins -= p.cost; save.paints.push(p.id); }
      save.paint = p.id; persist(); this.game.bike.tankMat.color.set(p.tank); this.garage();
    });
    show("garage");
  }

  // ---------- settings ----------
  settings() {
    const t = (k: "sound" | "music" | "haptics", label: string) => `<div class="item"><div class="tx"><b>${label}</b></div><button class="toggle ${save.settings[k] ? "on" : ""}" data-t="${k}"></button></div>`;
    $("settings").innerHTML = `<div class="wrap">
      <div class="topbar"><button class="icon-btn" data-go="home">←</button><h2>Settings</h2></div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px">${t("sound", "Sound effects")}${t("music", "Music")}${t("haptics", "Vibration")}
        <div class="item"><div class="tx"><b>Graphics</b><small>Low is smoother on older phones (applies on restart)</small></div><button class="chip ${save.settings.quality === "high" ? "on" : ""}" id="q">${save.settings.quality === "high" ? "High" : "Low"}</button></div>
      </div>
      <div class="card"><div class="label">About</div><p class="muted" style="margin:0;font-size:13px;line-height:1.5">A game about Karachi's University Road, Hassan Square to Safoora Chowrangi. Places follow the real road; hazards follow what commuters actually face: BRT Red Line works, sewage, potholes and dust.</p></div>
      <button class="btn" id="reset" style="color:var(--bad)">Reset progress</button>
    </div>`;
    const root = $("settings"); this.wire(root);
    root.querySelectorAll<HTMLElement>("[data-t]").forEach(b => b.onclick = () => { const k = b.dataset.t as "sound"; save.settings[k] = !save.settings[k]; persist(); this.settings(); });
    $("q").onclick = () => { save.settings.quality = save.settings.quality === "high" ? "low" : "high"; persist(); this.settings(); };
    $("reset").onclick = () => { if (confirm("Delete all coins, fixes and upgrades?")) { try { localStorage.clear(); } catch { /* ignore */ } location.reload(); } };
    show("settings");
  }

  // ---------- input ----------
  private bindControls() {
    const g = this.game;
    const playing = () => g.running && !g.paused;
    addEventListener("keydown", e => {
      if (e.key === "Escape" || e.key === "p") { if (playing()) this.pause(); return; }
      if (!playing()) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") g.left();
      else if (k === "arrowright" || k === "d") g.right();
      else if (k === "arrowup" || k === "w" || k === " ") g.jump();
      else if (k === "arrowdown" || k === "s") g.brake = true;
      else if (k === "h") g.horn();
      else return;
      e.preventDefault();
    });
    addEventListener("keyup", e => { const k = e.key.toLowerCase(); if (k === "arrowdown" || k === "s") g.brake = false; });
    const cv = $("scene");
    let sx = 0, sy = 0, swiped = false, down = false;
    cv.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; swiped = false; down = true; });
    cv.addEventListener("pointermove", e => {
      if (!down || swiped || !playing()) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      swiped = true;
      if (Math.abs(dx) > Math.abs(dy)) (dx > 0 ? g.right() : g.left());
      else if (dy < 0) g.jump(); else g.brake = true;
    });
    const up = () => { down = false; g.brake = false; };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    document.addEventListener("visibilitychange", () => { if (document.hidden && playing()) this.pause(); });
  }
}

// Light, Google-Maps-like backdrop: faint street grid behind the real route.
const MAP_DEFS = `style="background:#f1f3f4"`;

const SHORT: Record<string, string> = {
  potholes: "Fix Potholes", manholes: "Cover Manholes", sewage: "Clear Gutter", breakers: "Remove Breakers",
  construction: "Finish BRT", crossing: "Ped. Bridge", cattle: "Clear Cattle", traffic: "Traffic Police",
  busstop: "Bus Bays", oneway: "Stop Wrong-way", dust: "Stop Dust",
};
const shortFix = (id: string) => SHORT[id] ?? id;

/** One-line summary of what's still broken on the chosen trip. */
function tripCondition(from: number, to: number) {
  if (from === to) return "Pick two different places";
  const [lo, hi] = [Math.min(from, to), Math.max(from, to)];
  let open = 0, total = 0;
  for (let s = lo; s < hi; s++) for (const f of FIXES) { total++; if (!isFixed(s, f.id)) open++; }
  const pct = Math.round((1 - open / total) * 100);
  return pct >= 100 ? "Fully repaired, smooth ride" : pct > 50 ? `Partly repaired (${pct}%)` : `Rough: potholes, gutter, dust (${pct}% fixed)`;
}
