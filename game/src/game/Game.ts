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
  day: { sky: 0xf3dcae, fog: 0xf3dcae, hemi: 1.0, sun: 1.4, ground: 0xc9ac78 },
  evening: { sky: 0xf0a86a, fog: 0xe8a070, hemi: 0.75, sun: 1.0, ground: 0xb08c64 },
  night: { sky: 0x0c1022, fog: 0x0c1022, hemi: 0.25, sun: 0.1, ground: 0x3a3226 },
};

export interface HudState {
  hp: number; maxHp: number; coins: number; speed: number; remaining: number; progress: number;
  next: string; nextDist: number; magnet: number; shield: number; combo: number;
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
    this.scene.fog = new THREE.Fog(0xf3dcae, 50, 190);
    this.scene.background = new THREE.Color(0xf3dcae);
    this.sun.position.set(-8, 14, 6);
    this.scene.add(this.hemi, this.sun);

    // road texture: asphalt with patches, cracks, lane dashes and yellow edges
    const c = document.createElement("canvas"); c.width = 512; c.height = 512; const x = c.getContext("2d")!;
    x.fillStyle = "#4a4a4d"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2500; i++) { x.fillStyle = ["#444447", "#525255", "#3d3d40", "#57534c"][i % 4]; x.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3); }
    for (let i = 0; i < 6; i++) { x.fillStyle = "rgba(30,30,32,.45)"; x.fillRect(40 + Math.random() * 400, Math.random() * 512, 40 + Math.random() * 60, 30 + Math.random() * 80); }
    x.strokeStyle = "rgba(20,20,20,.6)"; x.lineWidth = 2;
    for (let i = 0; i < 8; i++) { x.beginPath(); let px = Math.random() * 512, py = Math.random() * 512; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (Math.random() - .5) * 40; py += Math.random() * 30; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = "#ececec"; for (const lx of [170, 338]) x.fillRect(lx, 0, 8, 256);
    x.fillStyle = "#f5c518"; x.fillRect(6, 0, 10, 512); x.fillRect(496, 0, 10, 512);
    this.roadTex = new THREE.CanvasTexture(c); this.roadTex.wrapT = THREE.RepeatWrapping; this.roadTex.repeat.set(1, 30);
    this.roadTex.colorSpace = THREE.SRGBColorSpace; this.roadTex.anisotropy = 8;

    this.bike = M.makeBike(save.paint === "classic" ? "#d62828" : "#d62828");
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
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 420, 1, 60), M.texMat(this.roadTex));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -170); this.scene.add(road);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 420, 1, 60), M.mat(0xc9ac78));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(0, -0.03, -170); this.scene.add(this.ground);
    // BRT Red Line corridor on the left: barriers and half-built concrete; footpath on the right
    const median = M.box(2.6, 0.9, 420, 0xb8b0a0, -ROAD_W / 2 - 1.3, 0.45, -170); this.scene.add(median);
    const stripe = M.box(2.62, 0.18, 420, 0xd9480f, -ROAD_W / 2 - 1.3, 0.8, -170); this.scene.add(stripe);
    const path = M.box(2.2, 0.25, 420, 0xa39b8e, ROAD_W / 2 + 1.1, 0.12, -170); this.scene.add(path);
    const brtDeck = M.box(7, 0.6, 420, 0x9c9488, -ROAD_W / 2 - 6, 0.3, -170); this.scene.add(brtDeck);

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
  }

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
      this.scene.add(grp); this.landmarks.push({ obj: grp, at });
    });
    this.running = true; this.paused = false;
    audio.startEngine();
  }
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
    this.hemi.intensity = s.hemi * (weather === "rain" ? 0.8 : 1);
    this.sun.intensity = s.sun * (weather === "rain" ? 0.4 : 1);
    this.sun.color.set(time === "evening" ? 0xffb070 : 0xffffff);
    (this.ground.material as THREE.MeshLambertMaterial).color.set(weather === "rain" ? 0x7d6c55 : s.ground);
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
      case "barrier": this.add({ kind, at, x, w: 2.1, d: 1.2, sec }, M.makeBarrier()); return lane;
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

  private end(arrived: boolean) {
    this.running = false; audio.stopEngine();
    const bonus = arrived ? 20 + Math.round(this.hp / this.maxHp * 30) : 0;
    if (arrived) audio.win();
    this.onEnd?.({ arrived, coins: arrived ? this.coins : Math.floor(this.coins / 2), bonus, distance: this.prog, hp: Math.max(0, this.hp), dest: this.dest, hits: this.hits, sections: [...this.secs].sort((a, b) => a - b), time: this.t });
  }

  // ---------- render ----------
  private render(dt: number) {
    const prog = this.running || this.prog > 0 ? this.prog : (performance.now() / 1000) * 9;
    const idle = !this.running;
    if (idle && !this.paused) this.prog = 0;
    const p = idle ? (performance.now() / 1000) * 9 : prog;
    this.roadTex.offset.y = p / 14;
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
    for (const l of this.landmarks) { const d = l.at - this.prog; if (d > 0 && d < nextDist) { nextDist = d; next = (l.obj.children[1] as THREE.Object3D).userData.name; } }
    this.onHud({ hp: this.hp, maxHp: this.maxHp, coins: this.coins, speed: this.v * 3.2, remaining: Math.max(0, this.len - this.prog), progress: Math.min(1, this.prog / this.len), next, nextDist, magnet: this.magnet, shield: this.shield, combo: this.combo });
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

function vibrate(ms: number) {
  if (!save.settings.haptics) return;
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
