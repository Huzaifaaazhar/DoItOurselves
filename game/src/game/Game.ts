import * as THREE from "three";
import {
  PLACES, Place, Hazard, hazardWeights, DUST_CHANCE, placeDist, sectionAt, fixFor,
} from "../data/route";
import { save, isFixed, UPGRADES } from "../state";
import { audio } from "./audio";
import * as M from "./models";

export const LANES = [-2.4, 0, 2.4];
const ROAD_W = 8.2;
const VIEW = 170;

export type TimeOfDay = "day" | "evening" | "night";
export type Weather = "clear" | "dusty" | "rain";
export interface RideOptions { from: number; to: number; time: TimeOfDay; weather: Weather }
export interface RideResult {
  arrived: boolean; coins: number; bonus: number; distance: number; hp: number; dest: Place;
  hits: Partial<Record<Hazard | "dust", number>>; sections: number[]; time: number;
}

type Obj = {
  kind: Hazard | "coin" | "power" | "dust";
  at: number; x: number; w: number; d: number; sec: number;
  mesh?: THREE.Object3D; hit?: boolean; y?: number;
  // movers
  v?: number; vx?: number; tx?: number; ttl?: number; stop?: number; style?: "cut" | "brake" | "plain" | "busstop";
  veh?: M.Vehicle; power?: M.PowerKind; len?: number; scared?: boolean; lane?: number;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function weighted<T extends string>(w: Record<T, number>): T | null {
  const entries = Object.entries(w) as [T, number][];
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const [k, v] of entries) if ((r -= v) <= 0) return k;
  return entries[entries.length - 1][0];
}

const SKY: Record<TimeOfDay, { sky: number; fog: number; hemi: number; sun: number; ground: number }> = {
  day: { sky: 0xe9cfa0, fog: 0xe9cfa0, hemi: 1.1, sun: 2.2, ground: 0xc9ac78 },
  evening: { sky: 0xf0a86a, fog: 0xe8a070, hemi: 0.8, sun: 1.6, ground: 0xb08c64 },
  night: { sky: 0x0c1022, fog: 0x0c1022, hemi: 0.25, sun: 0.1, ground: 0x3a3226 },
};

export interface HudState {
  hp: number; maxHp: number; coins: number; speed: number; remaining: number; progress: number;
  next: string; nextDist: number; magnet: number; shield: number; combo: number; status: string;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);
  hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a7350, 1);
  sun = new THREE.DirectionalLight(0xffffff, 1.4);
  bike: M.BikeRig;
  roadTex: THREE.CanvasTexture;
  ground!: THREE.Mesh;
  rainPts!: THREE.LineSegments; dustPts!: THREE.Points;
  scenery: { obj: THREE.Object3D; at: number; light?: M.StreetLight }[] = [];
  landmarks: { obj: THREE.Object3D; at: number }[] = [];
  objs: Obj[] = [];

  // ride state
  running = false; paused = false;
  opts!: RideOptions;
  from = 0; dir = 1; len = 0; dest!: Place;
  prog = 0; v = 0; lane = 1; x = 0; y = 0; vy = 0;
  hp = 100; maxHp = 100; coins = 0; inv = 0; slow = 0; shake = 0; dust = 0; t = 0;
  magnet = 0; shield = 0; combo = 0; brake = false; next = 40;
  hits: RideResult["hits"] = {}; secs = new Set<number>();
  onHud?: (h: HudState) => void;
  onToast?: (msg: string, tone?: "bad" | "good" | "info") => void;
  onEnd?: (r: RideResult) => void;
  private last = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: save.settings.quality === "high", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(save.settings.quality === "high" ? 2 : 1, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = save.settings.quality === "high";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.fog = new THREE.Fog(0xe9cfa0, 50, 190);
    this.scene.background = new THREE.Color(0xe9cfa0);
    this.sun.position.set(-8, 16, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.roadTex = roadTexture(true);
    this.smoothTex = roadTexture(false);

    this.bike = M.makeBike(paintColor());
    castShadows(this.bike.group);
    this.scene.add(this.bike.group);
    this.buildStatic();
    this.resize();
    addEventListener("resize", () => this.resize());
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = this.camera.aspect < 0.75 ? 70 : 58; this.camera.updateProjectionMatrix();
  }

  private buildStatic() {
    this.roughRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 1.6, 420, 1, 60), M.texMat(this.roadTex));
    this.smoothRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 420, 1, 60), M.texMat(this.smoothTex));
    for (const r of [this.roughRoad, this.smoothRoad]) { r.rotation.x = -Math.PI / 2; r.position.set(0, 0, -170); r.receiveShadow = true; this.scene.add(r); }
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 420, 1, 60), M.texMat(dirtTexture()));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(0, -0.03, -170); this.ground.receiveShadow = true; this.scene.add(this.ground);
    // Left side: BRT Red Line corridor. Under construction = green hoarding and rubble;
    // once the stretch's construction is fixed, the finished elevated track appears instead.
    this.brtWorks = new THREE.Group();
    const hoard = M.makeHoarding(420); hoard.position.set(-ROAD_W / 2 - 1.6, 0, -170); this.brtWorks.add(hoard);
    this.brtWorks.add(M.box(7, 0.5, 420, 0x9c9488, -ROAD_W / 2 - 6, 0.25, -170));
    for (let i = 0; i < 18; i++) { const s = M.makeSand(); s.position.set(-ROAD_W / 2 - 4 - Math.random() * 4, 0.4, -i * 22); this.brtWorks.add(s); }
    this.scene.add(this.brtWorks);
    this.brtDone = M.makeElevatedBRT(420); this.brtDone.position.set(-ROAD_W / 2 - 4.5, 0, -170); this.brtDone.visible = false;
    this.brtDone.add(M.box(1.2, 0.3, 420, 0xf5c518, 3.9, 0.15, 0)); // painted kerb
    this.scene.add(this.brtDone);
    const path = M.box(2.2, 0.25, 420, 0xa39b8e, ROAD_W / 2 + 1.1, 0.12, -170); path.receiveShadow = true; this.scene.add(path);
    // overhead power lines on the right (poles are recycled with the scenery)
    for (const dx of [-0.9, 0, 0.9]) this.scene.add(M.box(0.03, 0.03, 420, 0x1a1a1a, ROAD_W / 2 + 7.5 + dx, 8.45 - Math.abs(dx) * 0.1, -170));

    // particles: dust & rain
    const pg = new THREE.BufferGeometry(); const pn = 500; const pp = new Float32Array(pn * 3);
    for (let i = 0; i < pn; i++) { pp[i * 3] = rnd(-14, 14); pp[i * 3 + 1] = rnd(0, 7); pp[i * 3 + 2] = rnd(-70, 6); }
    pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    this.dustPts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xb08a50, size: 0.3, transparent: true, opacity: 0 }));
    this.scene.add(this.dustPts);
    const rg = new THREE.BufferGeometry(); const rn = 700; const rp = new Float32Array(rn * 6);
    for (let i = 0; i < rn; i++) { const X = rnd(-14, 14), Y = rnd(0, 12), Z = rnd(-60, 6); rp.set([X, Y, Z, X + 0.05, Y - 0.6, Z + 0.2], i * 6); }
    rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    this.rainPts = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0.55 }));
    this.rainPts.visible = false; this.scene.add(this.rainPts);
  }

  private buildScenery(night: boolean) {
    for (const s of this.scenery) this.scene.remove(s.obj);
    this.scenery = [];
    // buildings both sides, recycled along a ROUTE_LEN strip
    for (const side of [-1, 1]) {
      let z = 0;
      while (z < 260) {
        const b = M.makeBuilding(night);
        const off = side < 0 ? -ROAD_W / 2 - 13 - b.w / 2 : ROAD_W / 2 + 6 + b.w / 2;
        b.group.position.x = off; b.group.rotation.y = side < 0 ? Math.PI : 0;
        this.scene.add(b.group); this.scenery.push({ obj: b.group, at: z });
        z += 9 + Math.random() * 6;
      }
    }
    for (let i = 0; i < 22; i++) {
      const l = M.makeStreetLight(); l.group.position.x = ROAD_W / 2 + 0.6;
      this.scene.add(l.group); this.scenery.push({ obj: l.group, at: i * 12, light: l });
    }
    for (let i = 0; i < 14; i++) {
      const t = M.makeTree(); t.position.x = ROAD_W / 2 + 3 + Math.random() * 1.5;
      this.scene.add(t); this.scenery.push({ obj: t, at: i * 19 + 5 });
    }
    for (let i = 0; i < 3; i++) {
      const b = M.makeBillboard(); b.position.x = -ROAD_W / 2 - 10; b.rotation.y = 0.35;
      this.scene.add(b); this.scenery.push({ obj: b, at: i * 90 + 40 });
    }
    for (let i = 0; i < 9; i++) {
      const p = M.makePowerPole(); p.position.x = ROAD_W / 2 + 7.5;
      this.scene.add(p); this.scenery.push({ obj: p, at: i * 30 + 8 });
    }
    for (let i = 0; i < 6; i++) {
      const c = M.makeCrowd(2 + Math.floor(Math.random() * 4)); c.position.x = ROAD_W / 2 + 0.6;
      this.scene.add(c); this.scenery.push({ obj: c, at: i * 45 + 20 });
    }
    for (const s of this.scenery) castShadows(s.obj);
  }
  roughRoad!: THREE.Mesh; smoothRoad!: THREE.Mesh; smoothTex: THREE.CanvasTexture;
  brtWorks!: THREE.Group; brtDone!: THREE.Group;
  ended = false; warned = new Set<string>(); swerveCd = 0; status = ""; skyCol = new THREE.Color(0xe9cfa0);
  onBanner?: (text: string, kind: "goal" | "warn" | "swerve-left" | "swerve-right" | "info") => void;

  // ---------- ride lifecycle ----------
  start(opts: RideOptions) {
    this.clearRide();
    this.opts = opts;
    const a = PLACES[opts.from], b = PLACES[opts.to];
    this.from = placeDist(a); this.dir = Math.sign(placeDist(b) - this.from); this.len = Math.abs(placeDist(b) - this.from); this.dest = b;
    this.prog = 0; this.v = 8; this.lane = 1; this.x = 0; this.y = 0; this.vy = 0;
    this.maxHp = 100 + save.upgrades.helmet * 20; this.hp = this.maxHp;
    this.coins = 0; this.inv = 0; this.slow = 0; this.shake = 0; this.dust = 0; this.t = 0;
    this.magnet = 0; this.shield = 0; this.combo = 0; this.next = 45; this.hits = {}; this.secs = new Set();
    this.applyLook(opts.time, opts.weather);
    // landmarks for this trip
    PLACES.forEach(p => {
      const at = (placeDist(p) - this.from) * this.dir;
      if (at < -20 || at > this.len + 60) return;
      const grp = new THREE.Group();
      grp.add(M.makeGantry(p.name, p.urdu));
      const lm = M.makeLandmark(p.kind, p.id, p.name);
      if (this.dir < 0) lm.scale.x = -1; // keep landmarks on the correct side when riding back
      grp.add(lm);
      grp.userData.name = p.name; castShadows(grp);
      this.scene.add(grp); this.landmarks.push({ obj: grp, at });
    });
    // destination campuses: the gate stands across the end of the ride, like arriving at the real entrance
    if (b.id === "ned" || b.id === "ku") {
      const gate = M.makeCampusGate(b.id === "ned" ? "NED UET, KARACHI" : "UNIVERSITY OF KARACHI", b.id === "ned" ? "#b0784a" : "#cdb48a");
      const grp = new THREE.Group(); grp.add(gate); grp.userData.name = b.name; castShadows(grp);
      this.scene.add(grp); this.landmarks.push({ obj: grp, at: this.len + 16 });
    }
    this.running = true; this.paused = false; this.ended = false;
    this.warned = new Set(); this.swerveCd = 0;
    audio.startEngine();
    setTimeout(() => this.onBanner?.(`GOAL: Reach ${b.name} (${Math.abs(b.km - a.km).toFixed(1)}km)`, "goal"), 300);
  }
  /** Back to the idle menu backdrop. */
  reset() { this.running = false; this.ended = false; this.paused = false; this.clearRide(); audio.stopEngine(); }
  private clearRide() {
    for (const o of this.objs) if (o.mesh) this.scene.remove(o.mesh);
    for (const l of this.landmarks) this.scene.remove(l.obj);
    this.objs = []; this.landmarks = [];
  }
  private applyLook(time: TimeOfDay, weather: Weather) {
    const s = SKY[time];
    const sky = new THREE.Color(weather === "rain" ? (time === "night" ? 0x0a0d18 : 0x8f98a3) : s.sky);
    (this.scene.background as THREE.Color).copy(sky);
    this.scene.fog!.color.copy(sky);
    this.skyCol.copy(sky);
    this.hemi.intensity = s.hemi * (weather === "rain" ? 0.8 : 1);
    this.sun.intensity = s.sun * (weather === "rain" ? 0.4 : 1);
    this.sun.color.set(time === "evening" ? 0xffb070 : 0xffffff);
    (this.ground.material as THREE.MeshStandardMaterial).color.set(weather === "rain" ? 0x9a8a76 : time === "night" ? 0x6a6258 : 0xffffff);
    const night = time === "night";
    this.buildScenery(night);
    this.bike.headlight.intensity = night || weather === "rain" ? 60 : 0;
    this.bike.tankMat.color.set(paintColor());
    this.rainPts.visible = weather === "rain";
    this.baseFog = weather === "dusty" ? [25, 110] : weather === "rain" ? [20, 120] : [50, 190];
  }
  baseFog: [number, number] = [50, 190];

  private roadPos(p: number) { return this.from + this.dir * p; }

  // ---------- spawning ----------
  private spawn(at: number) {
    const sec = sectionAt(this.roadPos(at));
    if (Math.random() < DUST_CHANCE[sec] * (this.opts.weather === "dusty" ? 3 : 1) && !isFixed(sec, "dust")) {
      this.objs.push({ kind: "dust", at, x: 0, w: 0, d: 0, sec, len: rnd(80, 130) });
    }
    const w = hazardWeights(sec);
    for (const h of Object.keys(w) as Hazard[]) if (isFixed(sec, fixFor(h).id)) w[h] = 0;
    const kind = Math.random() < 0.85 ? weighted(w) : null;
    const lane = Math.floor(Math.random() * 3);
    let blockedLane = -1;
    if (kind) { blockedLane = this.spawnHazard(kind, at, lane, sec); }
    // second hazard on busy stretches later in the ride, never blocking all lanes
    if (kind && Math.random() < Math.min(0.45, this.prog / 4000)) {
      const k2 = weighted(w); const l2 = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      if (k2 && !["breaker", "walker", "cattle"].includes(k2) && !["breaker"].includes(kind)) this.spawnHazard(k2, at + rnd(-2, 2), l2, sec);
    }
    // coins
    if (Math.random() < 0.65) {
      const jumpable = kind && ["pothole", "manhole", "gutter", "breaker", "sand"].includes(kind);
      const cl = jumpable && Math.random() < 0.5 ? (blockedLane >= 0 ? blockedLane : lane) : pick([0, 1, 2].filter(l => l !== blockedLane));
      const arc = jumpable && (cl === blockedLane || kind === "breaker");
      for (let k = 0; k < 6; k++) {
        const y = arc ? 0.9 + Math.sin((k / 5) * Math.PI) * 2.2 : 0.9;
        this.add({ kind: "coin", at: at - 7.5 + k * 3, x: LANES[cl], w: 0.8, d: 0.8, sec, y }, M.makeCoin());
      }
    } else if (Math.random() < 0.12) {
      const p = pick<M.PowerKind>(["magnet", "helmet", "chai"]);
      this.add({ kind: "power", at: at + 8, x: LANES[pick([0, 1, 2].filter(l => l !== blockedLane))], w: 1, d: 1, sec, y: 1.2, power: p }, M.makePower(p));
    }
  }
  private add(o: Obj, mesh: THREE.Object3D) { o.mesh = mesh; this.scene.add(mesh); this.objs.push(o); return o; }

  /** Returns the lane it blocks (or -1 for none/all). */
  private spawnHazard(kind: Hazard, at: number, lane: number, sec: number): number {
    const x = LANES[lane];
    switch (kind) {
      case "pothole": { const w = rnd(1.2, 2.0); this.add({ kind, at, x: x + rnd(-0.4, 0.4), w, d: w * 0.75, sec }, M.makePothole(w)); return lane; }
      case "manhole": this.add({ kind, at, x, w: 1.3, d: 1.3, sec }, M.makeManhole()); return lane;
      case "gutter": {
        const two = Math.random() < 0.45; const w = two ? 5 : 2.6; const cx = two ? (lane === 0 ? -1.2 : 1.2) : x;
        this.add({ kind, at, x: cx, w, d: rnd(5, 8), sec }, M.makeGutter(w, 7)); return two ? -1 : lane;
      }
      case "breaker": this.add({ kind, at, x: 0, w: ROAD_W, d: 0.7, sec }, M.makeBreaker(ROAD_W)); return -1;
      case "barrier": this.add({ kind, at, x, w: 2.1, d: 1.2, sec }, castShadows(Math.random() < 0.4 ? M.makeRoadClosed() : M.makeBarrier())); return lane;
      case "sand": this.add({ kind, at, x, w: 2.2, d: 1.8, sec }, M.makeSand()); return lane;
      case "walker": {
        const L = Math.random() < 0.5;
        const p = M.makePerson();
        this.add({ kind, at: at + 25, x: L ? -6 : 6, vx: (L ? 1 : -1) * rnd(1.3, 2.1), w: 0.6, d: 0.6, sec }, p);
        if (Math.random() < 0.4) { const p2 = M.makePerson(); this.add({ kind, at: at + 26, x: L ? -7 : 7, vx: (L ? 1 : -1) * rnd(1.3, 2.1), w: 0.6, d: 0.6, sec }, p2); }
        return -1;
      }
      case "cattle": { const L = Math.random() < 0.5; const c = M.makeCow(); c.rotation.y = L ? -Math.PI / 2 : Math.PI / 2; this.add({ kind, at: at + 20, x: L ? -5 : 5, vx: (L ? 1 : -1) * rnd(0.5, 0.9), w: 1.9, d: 1, sec }, c); return -1; }
      case "wrongway": { const veh = M.makeWrongWay(); this.add({ kind, at: at + 40, x, w: veh.w, d: veh.d, sec, v: -rnd(7, 10), veh, tx: x, lane }, veh.group); return lane; }
      default: {
        const veh = kind === "car" ? M.makeCar() : kind === "rickshaw" ? M.makeRickshaw() : kind === "qingqi" ? M.makeQingqi() : kind === "bus" ? M.makeBus() : M.makeTanker();
        const style = kind === "bus" ? "busstop" : kind === "tanker" ? "plain" : pick<"cut" | "brake" | "plain">(["cut", "brake", "cut", "plain"]);
        const speed = kind === "tanker" || kind === "bus" ? rnd(5, 8) : kind === "qingqi" ? rnd(5, 7) : rnd(7, 12);
        this.add({ kind, at: at + 10, x, w: veh.w, d: veh.d, sec, v: speed, veh, style, tx: x, ttl: rnd(0.5, 2.5), stop: 0, lane }, veh.group);
        return lane;
      }
    }
  }

  // ---------- controls ----------
  left() { if (this.running && !this.paused && this.lane > 0) this.lane--; }
  right() { if (this.running && !this.paused && this.lane < 2) this.lane++; }
  jump() { if (this.running && !this.paused && this.y === 0) { this.vy = 10.5; audio.jump(); } }
  horn() {
    if (!this.running || this.paused) return;
    audio.horn();
    const range = 22 + save.upgrades.horn * 6;
    for (const o of this.objs) {
      const ahead = o.at - this.prog;
      if (ahead < 0 || ahead > range || o.hit) continue;
      if ((o.kind === "walker" || o.kind === "cattle") && !o.scared) { o.scared = true; o.vx = (o.vx ?? 1) * (o.kind === "cattle" ? 4 : 2.6); }
      if (o.veh && o.style === "cut" && Math.abs(o.x - this.x) < 1.5) o.ttl = 99; // they stop drifting into you
    }
  }

  // ---------- simulation ----------
  private toast(m: string, tone: "bad" | "good" | "info" = "bad") { this.onToast?.(m, tone); }
  private hurt(o: Obj, dmg: number, msg: string, big = false) {
    if (this.inv > 0) return;
    o.hit = true;
    this.hits[o.kind as Hazard] = (this.hits[o.kind as Hazard] ?? 0) + 1; this.secs.add(o.sec);
    this.combo = 0;
    if (this.shield > 0) { this.shield = 0; this.inv = 1; this.toast("Helmet saved you! ⛑️", "info"); audio.crash(false); return; }
    this.hp -= dmg; this.inv = 1.1; this.shake = big ? 0.5 : 0.3;
    this.toast(msg); audio.crash(big); vibrate(big ? 160 : 70);
  }

  private update(dt: number) {
    this.t += dt;
    const eng = save.upgrades.engine;
    const top = Math.min(28 + eng * 1.5, 15 + eng * 1.5 + this.prog / 220);
    const cap = this.slow > 0 ? 7 : top;
    const wet = this.opts.weather === "rain" ? 0.75 : 1;
    if (this.brake) this.v = Math.max(3, this.v - (28 + save.upgrades.brakes * 6) * wet * dt);
    else this.v = Math.min(cap, this.v + 7 * dt);
    if (this.v > cap) this.v = Math.max(cap, this.v - 30 * dt);
    this.prog += this.v * dt;
    this.x += (LANES[this.lane] - this.x) * Math.min(1, dt * 11 * wet);
    this.vy -= 30 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y === 0) this.vy = Math.max(0, this.vy);
    this.inv = Math.max(0, this.inv - dt); this.slow = Math.max(0, this.slow - dt); this.shake = Math.max(0, this.shake - dt);
    this.magnet = Math.max(0, this.magnet - dt); this.shield = Math.max(0, this.shield - dt);
    this.secs.add(sectionAt(this.roadPos(Math.min(this.prog, this.len - 1))));

    while (this.next < this.prog + VIEW && this.next < this.len - 30) {
      this.spawn(this.next);
      this.next += rnd(17, 30) * Math.max(0.55, 1 - this.prog / 5000);
    }

    const air = this.y > 0.4;
    let inDust = false;
    for (const o of this.objs) {
      if (o.kind === "dust") {
        if (this.prog > o.at && this.prog < o.at + o.len!) { inDust = true; if (!o.hit) { o.hit = true; this.hits.dust = (this.hits.dust ?? 0) + 1; this.secs.add(o.sec); this.toast("Dust storm! Aankhon mein mitti 😷", "info"); } }
        continue;
      }
      this.moveObj(o, dt);
      if (o.hit || !o.mesh) continue;
      // magnet pulls coins in
      if (o.kind === "coin" && this.magnet > 0 && o.at - this.prog < 25 && o.at - this.prog > -1) { o.x += (this.x - o.x) * Math.min(1, dt * 8); o.at += (this.prog - o.at) * Math.min(1, dt * 5); }
      const dz = o.at - this.prog;
      if (Math.abs(dz) > o.d / 2 + 0.85 || Math.abs(o.x - this.x) > o.w / 2 + 0.35) continue;
      const sup = 1 - save.upgrades.suspension * 0.12;
      switch (o.kind) {
        case "coin":
          if (Math.abs((o.y ?? 0.9) - (0.9 + this.y)) < 1.4) { o.hit = true; o.mesh.visible = false; this.coins++; this.combo++; audio.coin(); }
          break;
        case "power":
          o.hit = true; o.mesh.visible = false; audio.powerup();
          if (o.power === "magnet") { this.magnet = 8 + save.upgrades.magnet * 2; this.toast("Coin magnet! 🧲", "good"); }
          if (o.power === "helmet") { this.shield = 15; this.toast("Helmet: next hit is free ⛑️", "good"); }
          if (o.power === "chai") { this.hp = Math.min(this.maxHp, this.hp + 30); this.toast("Chai break! +30 health ☕", "good"); }
          break;
        case "pothole": if (!air) this.hurt(o, 10 * sup, "Khadda! 💥"); break;
        case "manhole": if (!air) { this.v *= 0.3; this.hurt(o, 22 * sup, "Open manhole! Bach gaye 😱", true); } break;
        case "gutter": if (!air) { this.slow = 1.4; this.hurt(o, 6, "Gutter ka paani 🤢"); audio.splash(); } break;
        case "sand": if (!air) { this.slow = 1.0; this.hurt(o, 12 * sup, "Mitti ka dher! 🏜️"); } else o.hit = true; break;
        case "breaker":
          if (air) { o.hit = true; break; }
          if (this.v > 11) this.hurt(o, 16 * sup, "Speed breaker! Jump or brake ⬆️"); else { o.hit = true; this.toast("Nicely slowed down 👍", "good"); }
          break;
        case "barrier": this.v = 2; this.hurt(o, 25, "Road band hai! BRT ka kaam 🚧", true); break;
        case "walker": if (!air) { this.v *= 0.4; this.hurt(o, 15, "Bhai dekh ke! 🚶"); } break;
        case "cattle": this.v *= 0.3; this.hurt(o, 22, "Gaye ko takkar! 🐄", true); break;
        case "wrongway": this.v *= 0.3; this.hurt(o, 26, "Wrong-way wala! ⛔", true); break;
        default: {
          const msg = o.style === "brake" ? "Beech sarak pe brake! 😡" : o.style === "busstop" ? "Bus beech mein ruk gayi 🚌" : o.style === "cut" ? "Lane cutter! 😤" : "Takkar! 💥";
          this.v = Math.min(this.v, (o.v ?? 5) * 0.4); this.hurt(o, o.kind === "bus" || o.kind === "tanker" ? 28 : 20, msg, true);
        }
      }
    }
    this.objs = this.objs.filter(o => {
      const keep = o.kind === "dust" ? o.at + o.len! > this.prog : o.at - this.prog > -14 && Math.abs(o.x) < 10;
      if (!keep && o.mesh) this.scene.remove(o.mesh);
      return keep;
    });
    this.dust += ((inDust ? 1 : 0) - this.dust) * Math.min(1, dt * 2);

    this.callouts(dt);
    audio.setEngine(this.v); audio.musicTick(dt);
    if (this.hp <= 0) return this.end(false);
    if (this.prog >= this.len) return this.end(true);
  }

  private moveObj(o: Obj, dt: number) {
    if (o.kind === "walker" || o.kind === "cattle") {
      o.x += o.vx! * dt;
      if (o.mesh) { o.mesh.rotation.y = o.vx! > 0 ? -Math.PI / 2 : Math.PI / 2; o.mesh.children.forEach(ch => { if (ch.name === "leg") ch.rotation.x = Math.sin(this.t * 10) * 0.5 * (ch.position.x > 0 ? 1 : -1); }); }
    }
    if (o.veh) {
      const ahead = o.at - this.prog;
      o.ttl! -= dt;
      if (o.style === "cut" && o.ttl! < 0 && ahead < 50 && ahead > 4) { o.lane = pick([0, 1, 2].filter(l => l !== o.lane && Math.abs(l - o.lane!) === 1)); o.tx = LANES[o.lane!]; o.ttl = rnd(2, 3.5); }
      if (o.style === "brake" && o.stop! <= 0 && o.ttl! < 0 && ahead < 32) { o.stop = 2.6; o.ttl = 999; }
      if (o.style === "busstop" && o.stop! <= 0 && o.ttl! < 0 && ahead < 45) { o.stop = 4; o.ttl = 999; }
      o.stop! -= dt;
      o.at += (o.stop! > 0 ? 0 : o.v!) * dt;
      o.x += Math.sign(o.tx! - o.x) * Math.min(Math.abs(o.tx! - o.x), 2.4 * dt);
      o.veh.tail.color.setHex(o.stop! > 0 || o.kind === "wrongway" ? 0xff2020 : 0x5a0b0b);
      if (o.kind === "wrongway") o.veh.tail.color.setHex(0xffffcc);
      o.veh.ind.color.setHex(Math.abs(o.tx! - o.x) > 0.05 && (this.t * 5 | 0) % 2 ? 0xffa500 : 0x3a2600);
      if (o.mesh) o.mesh.rotation.y = (o.tx! - o.x) * -0.08;
    }
    if (o.mesh) {
      o.mesh.position.set(o.x, o.y ?? 0, -(o.at - this.prog));
      if (o.kind === "coin") o.mesh.rotation.y += dt * 4;
      if (o.kind === "power") { o.mesh.rotation.y += dt * 2; o.mesh.position.y = 1.2 + Math.sin(this.t * 4) * 0.2; }
    }
  }

  /** Mockup-style warnings: goal, dust storm ahead, SWERVE!, gate approaching, road status. */
  private callouts(dt: number) {
    this.swerveCd = Math.max(0, this.swerveCd - dt);
    const sec = sectionAt(this.roadPos(Math.min(this.prog, this.len - 1)));
    for (const o of this.objs) {
      const ahead = o.at - this.prog;
      if (o.kind === "dust" && ahead > 0 && ahead < 70 && !this.warned.has("dust" + o.at)) { this.warned.add("dust" + o.at); this.onBanner?.("WARNING: Dust Storm!", "warn"); }
      if (this.swerveCd === 0 && !o.hit && ahead > 14 && ahead < 26 && Math.abs(o.x - LANES[this.lane]) < o.w / 2 + 0.3 &&
          ["pothole", "manhole", "barrier", "sand", "cattle", "wrongway"].includes(o.kind)) {
        const free = [this.lane - 1, this.lane + 1].filter(l => l >= 0 && l <= 2);
        this.onBanner?.("SWERVE!", free[0] < this.lane ? "swerve-left" : "swerve-right"); this.swerveCd = 2.5;
      }
    }
    const realLeft = (this.len - this.prog) / 600;
    if (realLeft < 0.5 && !this.warned.has("gate")) {
      this.warned.add("gate");
      const kind = this.dest.kind === "university" ? "Gate" : "";
      this.onBanner?.(`${this.dest.name}${kind ? " " + kind : ""} in 0.5km`, "info");
    }
    this.status = this.slow > 0 ? "Gutter ka Paani" : this.dust > 0.5 ? "Dust Storm" : !isFixed(sec, "potholes") ? "Road is rugged" : "Road is smooth";
  }

  private end(arrived: boolean) {
    this.running = false; this.ended = arrived; audio.stopEngine();
    if (arrived) setTimeout(() => this.onBanner?.("GOAL REACHED!", "goal"), 0);
    const bonus = arrived ? 20 + Math.round(this.hp / this.maxHp * 30) : 0;
    if (arrived) audio.win();
    this.onEnd?.({ arrived, coins: arrived ? this.coins : Math.floor(this.coins / 2), bonus, distance: this.prog, hp: Math.max(0, this.hp), dest: this.dest, hits: this.hits, sections: [...this.secs].sort((a, b) => a - b), time: this.t });
  }

  // ---------- render ----------
  private render(dt: number) {
    // after arriving, the bike rolls to a stop in front of the destination
    if (this.ended) { this.v = Math.max(0, this.v - 12 * dt); this.prog += this.v * dt; this.t += dt; this.x += (0 - this.x) * Math.min(1, dt * 3); this.lane = 1; }
    const idle = !this.running && !this.ended;
    const prog = idle ? (performance.now() / 1000) * 9 : this.prog;
    const p = prog;
    this.roadTex.offset.y = p / 14; this.smoothTex.offset.y = p / 14;
    const sec = this.opts ? sectionAt(this.roadPos(Math.max(0, Math.min(this.prog, this.len - 1)))) : 0;
    const smooth = !idle && isFixed(sec, "potholes");
    this.smoothRoad.visible = smooth; this.roughRoad.visible = !smooth;
    const built = !idle && isFixed(sec, "construction");
    this.brtDone.visible = built; this.brtWorks.visible = !built;
    const bus = this.brtDone.getObjectByName("brtBus"); if (bus) bus.position.z = -((performance.now() / 1000 * 14) % 300) + 150;
    this.sun.position.set(this.x - 8, 16, 6); this.sun.target.position.set(this.x, 0, -6);
    for (const s of this.scenery) { let z = (s.at - p) % 270; if (z < -20) z += 270; s.obj.position.z = -z; }
    for (const l of this.landmarks) l.obj.position.z = -(l.at - prog);

    // the road gently follows real bends: vary sideways bend over distance
    M.bend.value.x = Math.sin(this.roadPos(p) / 700) * 0.0009;

    const b = this.bike.group;
    b.position.set(this.x, this.y, 0);
    b.rotation.z = (this.x - LANES[this.lane]) * 0.22;
    b.rotation.x = this.y > 0.4 ? -0.3 : Math.sin(this.t * 25) * 0.008 * (this.v / 10);
    for (const w of this.bike.wheels) w.rotation.x -= this.v * dt * 3;
    b.visible = !(this.inv > 0 && (this.t * 14 | 0) % 2);
    const sh = this.shake > 0 ? (Math.random() - 0.5) * 0.3 : 0;
    const fovKick = Math.min(8, Math.max(0, this.v - 15) * 0.5);
    this.camera.fov = (this.camera.aspect < 0.75 ? 70 : 58) + fovKick; this.camera.updateProjectionMatrix();
    this.camera.position.set(this.x * 0.55 + sh, 3.9 + this.y * 0.35, 7.2);
    this.camera.lookAt(this.x * 0.35, 1.3, -10);

    // weather & dust
    const [n, f] = this.baseFog;
    const fog = this.scene.fog as THREE.Fog; fog.near = n - (n - 2) * this.dust; fog.far = f - (f - 24) * this.dust;
    fog.color.copy(this.skyCol).lerp(DUST_COL, this.dust * 0.9); (this.scene.background as THREE.Color).copy(fog.color);
    (this.dustPts.material as THREE.PointsMaterial).opacity = 0.85 * this.dust;
    const dp = this.dustPts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < dp.length; i += 3) { dp[i + 2] += (this.v + 8) * dt; dp[i] += 5 * dt; if (dp[i + 2] > 7) { dp[i + 2] = -70; dp[i] = rnd(-14, 14); } }
    this.dustPts.geometry.attributes.position.needsUpdate = true;
    if (this.rainPts.visible) {
      const rp = this.rainPts.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < rp.length; i += 6) { const dy = 22 * dt, dz = (this.v + 2) * dt; rp[i + 1] -= dy; rp[i + 4] -= dy; rp[i + 2] += dz; rp[i + 5] += dz; if (rp[i + 1] < 0 || rp[i + 2] > 7) { const X = rnd(-14, 14), Y = rnd(6, 12), Z = rnd(-60, 0); rp.set([X, Y, Z, X + 0.05, Y - 0.6, Z + 0.2], i); } }
      this.rainPts.geometry.attributes.position.needsUpdate = true;
    }
    const night = this.opts?.time === "night";
    for (const s of this.scenery) if (s.light) (s.light.bulb.material as THREE.MeshLambertMaterial) = M.mat(night ? 0xfff1b8 : 0xddd6b8, night ? { emissive: 0xffd36b } : {}) as THREE.MeshLambertMaterial;

    this.renderer.render(this.scene, this.camera);
  }

  private hudTick() {
    if (!this.onHud || !this.running) return;
    let next = this.dest.name, nextDist = this.len - this.prog;
    for (const l of this.landmarks) { const d = l.at - this.prog; if (d > 0 && d < nextDist) { nextDist = d; next = l.obj.userData.name ?? next; } }
    this.onHud({ hp: this.hp, maxHp: this.maxHp, coins: this.coins, speed: this.v * 3.2, remaining: Math.max(0, this.len - this.prog), progress: Math.min(1, this.prog / this.len), next, nextDist, magnet: this.magnet, shield: this.shield, combo: this.combo, status: this.status });
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.running && !this.paused) this.update(dt);
    if (!this.paused) this.render(dt);
    this.hudTick();
    requestAnimationFrame(this.loop);
  };
}

export const paintColor = () => ({ classic: "#d62828", black: "#1c1c1f", blue: "#1f6feb", green: "#11823b", gold: "#d4a017" } as Record<string, string>)[save.paint] ?? "#d62828";
export const upgradeLevel = (id: (typeof UPGRADES)[number]["id"]) => save.upgrades[id];

const DUST_COL = new THREE.Color(0xc98a45);

function castShadows<T extends THREE.Object3D>(o: T): T {
  if (!save.settings.quality || save.settings.quality === "high") o.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
}

/** Asphalt texture. Rough: patched, cracked, crumbling dirt edges. Smooth: fresh tarmac after the fix. */
function roadTexture(rough: boolean) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 1024; const x = c.getContext("2d")!;
  const W = 512, H = 1024, edge = rough ? 40 : 0;
  x.fillStyle = rough ? "#5a5650" : "#38393c"; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) {
    x.fillStyle = rough ? ["#4f4b45", "#615c55", "#47443f", "#6b655b"][i % 4] : ["#333437", "#3d3e41", "#2f3033"][i % 3];
    x.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  if (rough) {
    for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? "40,38,35" : "120,105,85"},.35)`; x.fillRect(edge + Math.random() * (W - 2 * edge - 120), Math.random() * H, 50 + Math.random() * 90, 40 + Math.random() * 120); }
    x.strokeStyle = "rgba(25,22,20,.7)"; x.lineWidth = 2;
    for (let i = 0; i < 16; i++) { x.beginPath(); let px = Math.random() * W, py = Math.random() * H; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - .5) * 50; py += Math.random() * 40; x.lineTo(px, py); } x.stroke(); }
    // crumbling sand-coloured edges where the asphalt meets the dirt shoulder
    for (const side of [0, 1]) for (let y = 0; y < H; y += 6) {
      const w = edge * (0.5 + Math.random() * 0.8);
      x.fillStyle = "#b39a72"; x.fillRect(side ? W - w : 0, y, w, 7);
    }
    x.fillStyle = "rgba(235,235,235,.55)"; for (const lx of [176, 330]) for (let y = 0; y < H; y += 128) if (Math.random() < 0.7) x.fillRect(lx, y, 7, 50 + Math.random() * 20);
  } else {
    x.fillStyle = "#f4f4f4"; for (const lx of [168, 336]) for (let y = 0; y < H; y += 128) x.fillRect(lx, y, 8, 64);
    x.fillStyle = "#f5c518"; x.fillRect(8, 0, 10, H); x.fillRect(W - 18, 0, 10, H);
  }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 15);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function dirtTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const x = c.getContext("2d")!;
  x.fillStyle = "#c2a679"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { x.fillStyle = ["#b39770", "#cfb48a", "#a88c64", "#d6bf98"][i % 4]; x.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4); }
  for (let i = 0; i < 30; i++) { x.fillStyle = "#8e7a5c"; x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 70); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function vibrate(ms: number) {
  if (!save.settings.haptics) return;
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
