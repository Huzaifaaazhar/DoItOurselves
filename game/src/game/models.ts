import * as THREE from "three";

// ---------- curved-world materials ----------
// Every material bends the world downward and sideways with distance, which gives
// the rolling-horizon look of modern lane runners and lets the road follow real bends.
export const bend = { value: new THREE.Vector2(0, 0.0012) };
const BEND_VERTEX = /* glsl */`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 bwp = modelMatrix * mvPosition;
float bdz = min(0.0, bwp.z);
bwp.x += uBend.x * bdz * bdz;
bwp.y -= uBend.y * bdz * bdz;
mvPosition = viewMatrix * bwp;
gl_Position = projectionMatrix * mvPosition;
`;
function patch<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = s => {
    s.uniforms.uBend = bend;
    s.vertexShader = "uniform vec2 uBend;\n" + s.vertexShader.replace("#include <project_vertex>", BEND_VERTEX);
  };
  return m;
}
const cache = new Map<string, THREE.Material>();
export function mat(color: number | string, opts: { emissive?: number; transparent?: boolean; opacity?: number; basic?: boolean } = {}) {
  const key = `${color}|${opts.emissive ?? ""}|${opts.opacity ?? ""}|${opts.basic ? 1 : 0}`;
  let m = cache.get(key);
  if (!m) {
    m = opts.basic
      ? new THREE.MeshBasicMaterial({ color, transparent: opts.transparent, opacity: opts.opacity ?? 1 })
      : new THREE.MeshStandardMaterial({ color, emissive: opts.emissive ?? 0, transparent: opts.transparent, opacity: opts.opacity ?? 1, roughness: 0.88, metalness: 0.02, flatShading: true });
    cache.set(key, patch(m));
  }
  return m;
}
export const texMat = (map: THREE.Texture, basic = false) =>
  patch(basic ? new THREE.MeshBasicMaterial({ map, transparent: true }) : new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 }));
export const ownMat = (color: number) => patch(new THREE.MeshBasicMaterial({ color }));

// ---------- primitives ----------
const geo = new Map<string, THREE.BufferGeometry>();
const g = <T extends THREE.BufferGeometry>(k: string, f: () => T) => (geo.get(k) as T) ?? (geo.set(k, f()), geo.get(k) as T);
export function box(w: number, h: number, d: number, c: number | string | THREE.Material, x = 0, y = 0, z = 0) {
  // long boxes need depth segments so the curved-world shader can bend them with the road
  const m = new THREE.Mesh(g(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d, 1, 1, d > 20 ? Math.ceil(d / 4) : 1)), c instanceof THREE.Material ? c : mat(c));
  m.position.set(x, y, z); return m;
}
export function cyl(rt: number, rb: number, h: number, c: number | string, seg = 12) {
  return new THREE.Mesh(g(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(c));
}
export function sphere(r: number, c: number | string, seg = 10) {
  return new THREE.Mesh(g(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7))), mat(c));
}
function wheel(r: number, w: number) {
  const grp = new THREE.Group();
  const t = new THREE.Mesh(g(`w${r},${w}`, () => new THREE.CylinderGeometry(r, r, w, 14)), mat(0x151515)); t.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(g(`h${r},${w}`, () => new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.02, 8)), mat(0x9a9a9a)); hub.rotation.z = Math.PI / 2;
  grp.add(t, hub); return grp;
}
export function textTexture(lines: { text: string; font: string; color?: string }[], w: number, h: number, bg: string, border = "#fff") {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")!;
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (border) { x.strokeStyle = border; x.lineWidth = Math.max(4, h / 30); x.strokeRect(10, 10, w - 20, h - 20); }
  x.textAlign = "center"; x.textBaseline = "middle";
  lines.forEach((l, i) => { x.fillStyle = l.color ?? "#fff"; x.font = l.font; x.fillText(l.text, w / 2, h * (i + 1) / (lines.length + 1)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- the player's CD70 ----------
export interface BikeRig { group: THREE.Group; wheels: THREE.Object3D[]; tankMat: THREE.MeshLambertMaterial; headlight: THREE.SpotLight; rider: THREE.Group }
export function makeBike(paint: string): BikeRig {
  const grp = new THREE.Group();
  const wF = wheel(0.34, 0.12), wB = wheel(0.34, 0.14);
  wF.position.set(0, 0.36, -0.72); wB.position.set(0, 0.36, 0.66); wF.rotation.y = wB.rotation.y = Math.PI / 2;
  // wheels spin about local x after rotation; keep separate holders
  const fH = new THREE.Group(); fH.add(wF); const bH = new THREE.Group(); bH.add(wB);
  grp.add(fH, bH);
  const tankMat = patch(new THREE.MeshLambertMaterial({ color: paint, flatShading: true }));
  grp.add(box(0.44, 0.3, 0.62, tankMat, 0, 0.92, -0.22));
  grp.add(box(0.3, 0.14, 0.3, tankMat, 0, 0.62, 0.66)); // rear mudguard
  grp.add(box(0.26, 0.1, 0.32, tankMat, 0, 0.58, -0.72)); // front mudguard
  grp.add(box(0.14, 0.14, 1.3, 0x2a2a2a, 0, 0.62, 0));
  grp.add(box(0.32, 0.3, 0.4, 0x3a3a3a, 0, 0.5, -0.05)); // engine
  grp.add(box(0.1, 0.1, 0.8, 0xbfbfbf, 0.22, 0.38, 0.3)); // silencer
  grp.add(box(0.4, 0.13, 0.72, 0x111111, 0, 1.05, 0.33)); // seat
  grp.add(box(0.06, 0.6, 0.06, 0x888888, 0, 0.9, -0.66)); // fork
  grp.add(box(0.9, 0.05, 0.05, 0xb0b0b0, 0, 1.24, -0.6)); // handlebar
  const lamp = cyl(0.14, 0.12, 0.12, 0xfff6c0); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 1.1, -0.74);
  (lamp.material as THREE.MeshLambertMaterial) = mat(0xfff6c0, { emissive: 0x8a7a30 }) as THREE.MeshLambertMaterial;
  grp.add(lamp);
  grp.add(box(0.2, 0.1, 0.05, 0xff2a2a, 0, 0.75, 0.84)); // tail light
  // rider: brown jacket, jeans, backpack, full-face helmet
  const rider = new THREE.Group();
  const jacket = 0x6b4a33, jeans = 0x34465c;
  const torso = box(0.56, 0.7, 0.36, jacket, 0, 1.52, 0.22); torso.rotation.x = -0.28; rider.add(torso);
  rider.add(box(0.5, 0.22, 0.62, jeans, 0, 1.17, 0.3)); // hips on the seat
  const pack = box(0.46, 0.56, 0.24, 0x7a5a3a, 0, 1.6, 0.48); pack.rotation.x = -0.28; rider.add(pack);
  rider.add(box(0.36, 0.2, 0.06, 0x5c4129, 0, 1.45, 0.62)); // backpack pocket
  for (const s of [-1, 1]) {
    rider.add(box(0.05, 0.6, 0.05, 0x3a2a1a, s * 0.17, 1.62, 0.36)); // straps
    const arm = box(0.14, 0.14, 0.62, jacket, s * 0.31, 1.5, -0.18); arm.rotation.x = 0.35; rider.add(arm);
    rider.add(box(0.12, 0.12, 0.12, 0x2a2a2a, s * 0.4, 1.3, -0.5)); // gloves on grips
    rider.add(box(0.17, 0.2, 0.5, jeans, s * 0.25, 1.05, -0.05)); // thigh
    rider.add(box(0.16, 0.42, 0.16, jeans, s * 0.27, 0.8, -0.28)); // shin
    rider.add(box(0.17, 0.14, 0.3, 0x2b1d12, s * 0.27, 0.58, -0.33)); // shoe
  }
  rider.add(box(0.18, 0.12, 0.18, 0xb88458, 0, 1.92, 0.12)); // neck
  const helmet = sphere(0.28, 0x3a3d42, 14); helmet.position.set(0, 2.1, 0.08); helmet.scale.set(1, 1.05, 1.12); rider.add(helmet);
  const visor = box(0.4, 0.16, 0.05, 0x111418, 0, 2.08, -0.22); rider.add(visor);
  rider.add(box(0.04, 0.3, 0.44, 0xd9480f, 0, 2.26, 0.1)); // helmet stripe
  grp.add(rider);
  const headlight = new THREE.SpotLight(0xfff2c4, 0, 45, 0.45, 0.5, 1.2);
  headlight.position.set(0, 1.1, -0.8); headlight.target.position.set(0, 0, -20); grp.add(headlight, headlight.target);
  return { group: grp, wheels: [wF, wB], tankMat, headlight, rider };
}

// ---------- traffic ----------
function tailLights(grp: THREE.Group, w: number, y: number, z: number) {
  const m = ownMat(0x5a0b0b);
  for (const s of [-1, 1]) grp.add(box(0.32, 0.18, 0.05, m, s * (w / 2 - 0.2), y, z));
  return m;
}
function indicators(grp: THREE.Group, w: number, y: number, z: number) {
  const m = ownMat(0x3a2600);
  for (const s of [-1, 1]) grp.add(box(0.14, 0.14, 0.05, m, s * (w / 2 - 0.05), y, z));
  return m;
}
export interface Vehicle { group: THREE.Group; tail: THREE.MeshBasicMaterial; ind: THREE.MeshBasicMaterial; w: number; d: number }

export function makeCar(): Vehicle {
  const col = [0xf1f3f5, 0xadb5bd, 0x1c7ed6, 0xc92a2a, 0x2b2b2b, 0xe8e2c8][Math.floor(Math.random() * 6)];
  const grp = new THREE.Group();
  grp.add(box(1.8, 0.7, 4, col, 0, 0.6, 0));
  grp.add(box(1.6, 0.6, 2.1, col, 0, 1.25, 0.15));
  grp.add(box(1.5, 0.45, 0.05, 0x7fa7c9, 0, 1.25, 1.21));
  grp.add(box(1.5, 0.45, 0.05, 0x7fa7c9, 0, 1.25, -0.91));
  grp.add(box(1.6, 0.25, 0.08, 0xdddddd, 0, 0.45, 2.01)); // bumper
  for (const [x, z] of [[-0.88, 1.25], [0.88, 1.25], [-0.88, -1.25], [0.88, -1.25]]) { const wl = wheel(0.34, 0.24); wl.position.set(x, 0.34, z); grp.add(wl); }
  return { group: grp, tail: tailLights(grp, 1.8, 0.8, 2.02), ind: indicators(grp, 1.8, 1.0, 2.02), w: 1.9, d: 4 };
}

export function makeRickshaw(): Vehicle {
  const grp = new THREE.Group();
  const body = [0x1e8a3c, 0x2f9e44, 0x0b7285][Math.floor(Math.random() * 3)];
  grp.add(box(1.35, 0.8, 2.3, body, 0, 0.75, 0.1));
  grp.add(box(1.4, 0.12, 2.4, 0x111111, 0, 1.75, 0.05)); // canopy top
  for (const s of [-1, 1]) grp.add(box(0.06, 0.9, 0.06, 0x111111, s * 0.65, 1.3, 1.1));
  grp.add(box(0.8, 0.5, 0.8, 0xfab005, 0, 1.4, -0.75)); // front cab
  grp.add(box(1.3, 0.3, 0.05, 0xfab005, 0, 1.45, 1.26)); // decorated back panel
  grp.add(box(0.3, 0.3, 0.05, 0xe03131, 0, 0.95, 1.27));
  const fw = wheel(0.25, 0.14); fw.position.set(0, 0.25, -1.0); grp.add(fw);
  for (const s of [-1, 1]) { const w = wheel(0.27, 0.16); w.position.set(s * 0.62, 0.27, 0.8); grp.add(w); }
  return { group: grp, tail: tailLights(grp, 1.3, 0.7, 1.27), ind: indicators(grp, 1.3, 1.6, 1.27), w: 1.4, d: 2.5 };
}

export function makeQingqi(): Vehicle {
  const grp = new THREE.Group();
  grp.add(box(0.4, 0.3, 0.6, 0xc92a2a, 0, 0.9, -1.3)); // bike front
  grp.add(box(0.06, 0.6, 0.06, 0x888888, 0, 0.8, -1.6));
  const fw = wheel(0.32, 0.12); fw.position.set(0, 0.32, -1.6); grp.add(fw);
  grp.add(box(1.5, 0.15, 2.0, 0x495057, 0, 0.6, 0.2)); // passenger deck
  grp.add(box(1.5, 0.1, 2.1, 0x5c3c92, 0, 2.0, 0.2)); // roof
  for (const [x, z] of [[-0.72, -0.75], [0.72, -0.75], [-0.72, 1.15], [0.72, 1.15]]) grp.add(box(0.06, 1.4, 0.06, 0xc0c0c0, x, 1.3, z));
  for (const s of [-1, 1]) grp.add(box(0.25, 0.5, 1.6, 0x8b5a2b, s * 0.55, 0.95, 0.2)); // benches
  for (const s of [-1, 1]) { const p = sphere(0.18, 0xc68e5e); p.position.set(s * 0.45, 1.55, 0.3); grp.add(p); }
  for (const s of [-1, 1]) { const w = wheel(0.3, 0.15); w.position.set(s * 0.7, 0.3, 0.8); grp.add(w); }
  return { group: grp, tail: tailLights(grp, 1.4, 0.65, 1.25), ind: indicators(grp, 1.4, 1.9, 1.25), w: 1.6, d: 3.4 };
}

let busTex: THREE.Texture | null = null;
export function makeBus(): Vehicle {
  if (!busTex) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d")!;
    const cols = ["#e03131", "#f59f00", "#2f9e44", "#1971c2", "#ae3ec9", "#fcc419"];
    for (let i = 0; i < 16; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * 16, 0, 16, 128); }
    x.fillStyle = "#fff"; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(16 + i * 32, 100, 9, 0, 7); x.fill(); }
    x.fillStyle = "#212529"; x.fillRect(0, 20, 256, 40);
    busTex = new THREE.CanvasTexture(c); busTex.colorSpace = THREE.SRGBColorSpace;
  }
  const grp = new THREE.Group();
  const side = texMat(busTex);
  grp.add(box(2.4, 2.4, 9, side, 0, 1.6, 0));
  grp.add(box(2.42, 0.5, 9.02, 0xf8f9fa, 0, 2.9, 0));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), texMat(textTexture([{ text: "W-11", font: "bold 90px Poppins, sans-serif", color: "#fcc419" }], 256, 170, "#c92a2a", "#fcc419")));
  back.position.set(0, 1.9, 4.51); grp.add(back);
  grp.add(box(1.0, 0.4, 0.6, 0x1a1a1a, 0, 3.3, -3)); // roof luggage
  for (const [x, z] of [[-1.1, 3], [1.1, 3], [-1.1, -3], [1.1, -3]]) { const w = wheel(0.5, 0.3); w.position.set(x, 0.5, z); grp.add(w); }
  return { group: grp, tail: tailLights(grp, 2.4, 0.8, 4.52), ind: indicators(grp, 2.4, 1.0, 4.52), w: 2.5, d: 9 };
}

export function makeTanker(): Vehicle {
  const grp = new THREE.Group();
  grp.add(box(2.3, 1.8, 2, 0x1864ab, 0, 1.5, -3.2)); // cab
  grp.add(box(2.1, 0.7, 0.05, 0x7fa7c9, 0, 1.9, -4.21));
  const tank = cyl(1.15, 1.15, 5.5, 0x1c7ed6, 14); tank.rotation.x = Math.PI / 2; tank.position.set(0, 1.9, 0.9); grp.add(tank);
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.8), texMat(textTexture([{ text: "WATER", font: "bold 60px Poppins, sans-serif" }, { text: "پانی", font: "bold 60px sans-serif" }], 256, 128, "#1864ab")));
  lbl.position.set(0, 1.9, 3.66); grp.add(lbl);
  grp.add(box(2.3, 0.3, 7.6, 0x222222, 0, 0.7, 0));
  for (const [x, z] of [[-1.05, -3], [1.05, -3], [-1.05, 2.5], [1.05, 2.5], [-1.05, 1.3], [1.05, 1.3]]) { const w = wheel(0.5, 0.3); w.position.set(x, 0.5, z); grp.add(w); }
  return { group: grp, tail: tailLights(grp, 2.3, 0.8, 3.81), ind: indicators(grp, 2.3, 1.1, 3.81), w: 2.4, d: 7.6 };
}

/** A biker riding the wrong way, toward the player. */
export function makeWrongWay(): Vehicle {
  const r = makeBike(["#1c1c1f", "#c92a2a", "#1f6feb"][Math.floor(Math.random() * 3)]);
  r.group.rotation.y = Math.PI; r.headlight.intensity = 0;
  const grp = new THREE.Group(); grp.add(r.group);
  const front = ownMat(0xffffcc);
  grp.add(box(0.25, 0.2, 0.05, front, 0, 1.1, 0.8));
  return { group: grp, tail: front, ind: ownMat(0x000000), w: 0.8, d: 1.8 };
}

// ---------- people & animals ----------
export function makePerson(): THREE.Group {
  const grp = new THREE.Group();
  const outfits = [[0xf8f9fa, 0xf8f9fa], [0x1c1c1c, 0x1c1c1c], [0x4dabf7, 0x343a40], [0xe64980, 0xe64980], [0x94d82d, 0xf1f3f5], [0x845ef7, 0x845ef7]];
  const [top, bot] = outfits[Math.floor(Math.random() * outfits.length)];
  grp.add(box(0.5, 0.8, 0.3, top, 0, 1.25, 0));
  for (const s of [-1, 1]) { const l = box(0.18, 0.8, 0.2, bot, s * 0.13, 0.4, 0); l.name = "leg"; grp.add(l); }
  for (const s of [-1, 1]) grp.add(box(0.12, 0.6, 0.14, top, s * 0.32, 1.25, 0));
  const head = sphere(0.19, 0xb07a4e); head.position.y = 1.85; grp.add(head);
  if (Math.random() < 0.4) grp.add(box(0.4, 0.5, 0.18, [0x2b8a3e, 0x1864ab, 0xe8590c][Math.floor(Math.random() * 3)], 0, 1.3, 0.24)); // student backpack
  if (Math.random() < 0.3) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff)); cap.position.y = 1.92; grp.add(cap); }
  return grp;
}
export function makeCow(): THREE.Group {
  const grp = new THREE.Group();
  const col = Math.random() < 0.5 ? 0xf1ece0 : 0x6b4a2f;
  grp.add(box(0.9, 0.8, 1.9, col, 0, 1.15, 0));
  const head = box(0.5, 0.5, 0.6, col, 0, 1.45, -1.15); grp.add(head);
  for (const s of [-1, 1]) { const h = cyl(0.04, 0.06, 0.35, 0xd9cbb0, 6); h.position.set(s * 0.22, 1.82, -1.15); h.rotation.z = s * 0.5; grp.add(h); }
  for (const [x, z] of [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]]) grp.add(box(0.16, 0.8, 0.16, col, x, 0.4, z));
  grp.add(box(0.06, 0.6, 0.06, col, 0, 1.0, 1.0));
  return grp;
}

// ---------- road hazards ----------
export function makePothole(w: number) {
  const grp = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 9), mat(0x141414)); hole.rotation.x = -Math.PI / 2; hole.scale.y = 0.75; hole.position.y = 0.025;
  const rim = new THREE.Mesh(new THREE.RingGeometry(w / 2, w / 2 + 0.25, 9), mat(0x6e6658)); rim.rotation.x = -Math.PI / 2; rim.scale.y = 0.75; rim.position.y = 0.022;
  grp.add(hole, rim);
  for (let i = 0; i < 4; i++) { const r = box(0.2, 0.1, 0.18, 0x5a5348, (Math.random() - 0.5) * w, 0.05, (Math.random() - 0.5) * w * 0.7); r.rotation.y = Math.random() * 3; grp.add(r); }
  return grp;
}
export function makeManhole() {
  const grp = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14), mat(0x050505)); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.03; grp.add(hole);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 14), mat(0x777777)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; grp.add(ring);
  // the classic Karachi warning: a branch stuck in the open manhole
  const stick = cyl(0.04, 0.05, 1.6, 0x5c3d1e, 5); stick.position.set(0.2, 0.8, 0); stick.rotation.z = 0.15; grp.add(stick);
  for (let i = 0; i < 3; i++) { const l = sphere(0.2, 0x4c7a2a, 5); l.position.set(0.3 + (Math.random() - 0.5) * 0.3, 1.5 + i * 0.15, (Math.random() - 0.5) * 0.3); grp.add(l); }
  return grp;
}
export function makeGutter(w: number, d: number) {
  const grp = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat(0x55602a, { transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(w / 2, d / 2, 1); water.position.y = 0.03; grp.add(water);
  const scum = new THREE.Mesh(new THREE.CircleGeometry(1, 12), mat(0x7a7d3a, { transparent: true, opacity: 0.8 }));
  scum.rotation.x = -Math.PI / 2; scum.scale.set(w / 4, d / 5, 1); scum.position.set(w * 0.1, 0.035, -d * 0.1); grp.add(scum);
  for (let i = 0; i < 4; i++) { const t = box(0.25, 0.04, 0.15, [0xffffff, 0x2f9e44, 0x1c7ed6][i % 3], (Math.random() - 0.5) * w * 0.7, 0.05, (Math.random() - 0.5) * d * 0.6); t.rotation.y = Math.random() * 3; grp.add(t); }
  const mh = cyl(0.45, 0.45, 0.06, 0x2a2a2a, 12); mh.position.set(-w * 0.2, 0.06, d * 0.15); grp.add(mh);
  return grp;
}
export function makeBreaker(width: number) {
  const grp = new THREE.Group();
  const n = 8;
  for (let i = 0; i < n; i++) grp.add(box(width / n, 0.22, 0.7, i % 2 ? 0xffd43b : 0x1a1a1a, -width / 2 + width / n * (i + 0.5), 0.11, 0));
  return grp;
}
let brtTex: THREE.Texture | null = null;
export function makeBarrier() {
  brtTex ??= textTexture([{ text: "RED LINE BRT", font: "bold 44px Poppins, sans-serif" }, { text: "کام جاری ہے", font: "bold 40px sans-serif" }], 320, 160, "#c92a2a");
  const grp = new THREE.Group();
  for (let i = 0; i < 2; i++) { // concrete jersey barriers
    const b = box(1.0, 0.9, 0.45, 0xbdb6a6, -0.5 + i * 1.0, 0.45, 0); grp.add(b);
    grp.add(box(1.0, 0.12, 0.47, 0xe8590c, -0.5 + i * 1.0, 0.75, 0));
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), texMat(brtTex)); sign.position.set(0, 1.45, 0.24); grp.add(sign);
  for (const s of [-1, 1]) grp.add(box(0.06, 1.2, 0.06, 0x555555, s * 0.7, 1.1, 0.2));
  for (const x of [-1.0, 1.0]) { const c = cyl(0.03, 0.28, 0.7, 0xff6b00, 10); c.position.set(x, 0.35, 1.0); grp.add(c); grp.add(box(0.4, 0.04, 0.4, 0x222222, x, 0.02, 1.0)); }
  return grp;
}
export function makeSand() {
  const grp = new THREE.Group();
  const p = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.0, 7), mat(0xb59866)); p.position.y = 0.5; p.scale.z = 0.8; grp.add(p);
  const q = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.6, 6), mat(0x9a8259)); q.position.set(0.6, 0.3, 0.4); grp.add(q);
  for (let i = 0; i < 3; i++) { const r = box(0.3, 0.2, 0.3, 0x7a7262, (Math.random() - 0.5) * 1.6, 0.1, 0.8 + Math.random() * 0.4); r.rotation.y = Math.random() * 3; grp.add(r); }
  return grp;
}

// ---------- pickups ----------
export function makeCoin() {
  const c = new THREE.Mesh(g("coin", () => new THREE.CylinderGeometry(0.36, 0.36, 0.09, 18)), mat(0xffc21a, { emissive: 0x6a4500 }));
  c.rotation.z = Math.PI / 2; const grp = new THREE.Group(); grp.add(c); return grp;
}
export type PowerKind = "magnet" | "helmet" | "chai";
export function makePower(kind: PowerKind) {
  const grp = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 20), mat(0xffffff, { emissive: 0x888888 })); grp.add(halo);
  if (kind === "magnet") { const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 12, Math.PI), mat(0xe03131, { emissive: 0x501010 })); m.rotation.z = Math.PI; grp.add(m); }
  if (kind === "helmet") { const h = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x339af0, { emissive: 0x0b3050 })); h.position.y = -0.1; grp.add(h); }
  if (kind === "chai") { const cup = cyl(0.22, 0.16, 0.4, 0xffffff, 10); grp.add(cup); const tea = cyl(0.2, 0.2, 0.02, 0xa0652a, 10); tea.position.y = 0.2; grp.add(tea); }
  return grp;
}

// ---------- scenery ----------
const BUILDING_COLS = [0xe9dcc3, 0xd8c3a5, 0xc9b79c, 0xf0e6d2, 0xbcae97, 0xa9c4bc, 0xe3c8a8, 0xd6cfc4];
let shopSigns: THREE.Texture[] | null = null;
const SHOP_NAMES = [["Bismillah Hotel", "بسم اللہ ہوٹل"], ["Madina Mobile", "مدینہ موبائل"], ["Al-Habib Pharmacy", "الحبیب فارمیسی"], ["Students Biryani", "اسٹوڈنٹس بریانی"], ["Karachi Bakery", "کراچی بیکری"], ["Photocopy Center", "فوٹو کاپی سینٹر"], ["Chai Dhaba", "چائے ڈھابہ"], ["Tyre Puncture", "پنکچر"]];
const SIGN_BGS = ["#c92a2a", "#1864ab", "#2b8a3e", "#e67700", "#5f3dc4", "#0b7285"];
export function makeBuilding(night: boolean) {
  shopSigns ??= SHOP_NAMES.map(([en, ur], i) => textTexture([{ text: ur, font: "bold 44px sans-serif" }, { text: en, font: "bold 34px Poppins, sans-serif" }], 384, 160, SIGN_BGS[i % SIGN_BGS.length]));
  const grp = new THREE.Group();
  const floors = 1 + Math.floor(Math.random() * 5), w = 5 + Math.random() * 4, d = 6 + Math.random() * 5, h = floors * 3;
  const col = BUILDING_COLS[Math.floor(Math.random() * BUILDING_COLS.length)];
  grp.add(box(w, h, d, col, 0, h / 2, 0));
  const win = mat(night ? 0xffd27a : 0x4a5866, night ? { emissive: 0x6a5020 } : {});
  for (let f = 1; f < floors; f++) for (let i = 0; i < 3; i++) if (Math.random() < 0.8) grp.add(box(0.05, 1.1, 1.1, win, w / 2 + 0.01, f * 3 + 1.5, -d / 3 + i * d / 3));
  grp.add(box(0.3, 0.15, d, 0x8a8174, w / 2 + 0.1, 3.0, 0)); // shop awning ledge
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.8, 1.2), texMat(shopSigns[Math.floor(Math.random() * shopSigns.length)]));
  sign.rotation.y = Math.PI / 2; sign.position.set(w / 2 + 0.05, 2.3, 0); grp.add(sign);
  if (Math.random() < 0.5) { const tank = cyl(0.5, 0.5, 0.9, 0x111111, 8); tank.position.set(-w / 4, h + 0.45, 0); grp.add(tank); } // rooftop water tank
  return { group: grp, w };
}
export function makeTree() {
  const grp = new THREE.Group();
  const t = cyl(0.15, 0.22, 2.2, 0x6b4f2a, 6); t.position.y = 1.1; grp.add(t);
  const k = Math.random() < 0.5;
  if (k) { for (let i = 0; i < 3; i++) { const l = sphere(1.0 + Math.random() * 0.5, [0x5c7a3a, 0x4d6b2e, 0x6b8a43][i], 6); l.position.set((Math.random() - 0.5), 2.6 + i * 0.4, (Math.random() - 0.5)); grp.add(l); } }
  else { // palm
    t.scale.set(0.7, 2, 0.7); t.position.y = 2.2;
    for (let i = 0; i < 6; i++) { const f = box(0.25, 0.05, 1.8, 0x4c7a2a, 0, 4.4, -0.8); const holder = new THREE.Group(); holder.add(f); holder.rotation.y = i; f.rotation.x = 0.4; grp.add(holder); }
  }
  return grp;
}
export interface StreetLight { group: THREE.Group; bulb: THREE.Mesh }
export function makeStreetLight(): StreetLight {
  const grp = new THREE.Group();
  grp.add(box(0.15, 6, 0.15, 0x6c6c6c, 0, 3, 0));
  grp.add(box(1.8, 0.1, 0.1, 0x6c6c6c, -0.85, 6, 0));
  const bulb = box(0.5, 0.15, 0.3, 0xddd6b8, -1.6, 5.9, 0); grp.add(bulb);
  return { group: grp, bulb };
}
export function makeBillboard() {
  const ads = [["Bijli ka bill?", "Solar lagwao!"], ["Admissions Open", "Session 2027"], ["Biryani Rs.350", "Double Botti"], ["Red Line BRT", "Coming Soon...?"]];
  const [a, b] = ads[Math.floor(Math.random() * ads.length)];
  const grp = new THREE.Group();
  for (const s of [-1, 1]) grp.add(box(0.2, 5, 0.2, 0x555555, s * 2, 2.5, 0));
  const t = textTexture([{ text: a, font: "bold 52px Poppins, sans-serif" }, { text: b, font: "bold 44px Poppins, sans-serif", color: "#ffd43b" }], 512, 220, SIGN_BGS[Math.floor(Math.random() * SIGN_BGS.length)]);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.4), texMat(t)); board.position.y = 6; grp.add(board);
  return grp;
}

// ---------- landmarks ----------
export function makeGantry(name: string, urdu: string) {
  const t = textTexture([{ text: urdu, font: "bold 60px sans-serif" }, { text: name, font: "bold 52px Poppins, sans-serif" }], 640, 220, "#11702f");
  const grp = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 2.9), texMat(t)); board.position.y = 6.6; grp.add(board);
  for (const s of [-1, 1]) grp.add(box(0.3, 8, 0.3, 0x7a7a7a, s * 4.6, 4, 0));
  grp.add(box(9.5, 0.25, 0.25, 0x7a7a7a, 0, 8.1, 0));
  return grp;
}
export function makeLandmark(kind: string, id: string, name: string): THREE.Group {
  const grp = new THREE.Group();
  if (kind === "chowrangi") {
    // roundabout off to the side with a monument, plus cross-street stubs
    const island = cyl(5, 5, 0.4, 0x6b8a43, 24); island.position.set(-14, 0.2, 0); grp.add(island);
    const ring = cyl(5.3, 5.3, 0.35, 0xe9e2d0, 24); ring.position.set(-14, 0.15, 0); grp.add(ring);
    const tower = cyl(0.6, 1, 6, 0xf1efe6, 8); tower.position.set(-14, 3.4, 0); grp.add(tower);
    const top = sphere(1, 0x2b8a3e, 8); top.position.set(-14, 6.8, 0); grp.add(top);
    for (const s of [-1, 1]) { const st = box(14, 0.03, 7, 0x4a4a4c, s * 11, 0.01, 0); grp.add(st); }
  } else if (id === "ned" || id === "ku") {
    grp.add(makeCampusGate(id === "ned" ? "NED UET, KARACHI" : "UNIVERSITY OF KARACHI", id === "ned" ? "#b0784a" : "#cdb48a"));
    const col = id === "ned" ? 0xa66f45 : 0xd9cdb4;
    for (let i = 0; i < 3; i++) grp.add(box(10, 6 + i * 2, 8, col, 24 + i * 4, 3 + i, -12 - i * 12));
    for (let i = 0; i < 4; i++) { const t = makeTree(); t.position.set(i % 2 ? 12 : -14, 0, -6 - i * 5); grp.add(t); }
  } else if (kind === "university") {
    const col = 0xb5a58a;
    for (const s of [-1, 1]) grp.add(box(1.4, 7, 1.4, col, s * 7.5, 3.5, 0));
    grp.add(box(16.4, 1.8, 1.4, col, 0, 7.5, 0));
    const t = textTexture([{ text: name, font: "bold 46px Poppins, sans-serif", color: "#11291b" }], 640, 90, "#f1e9d2", "");
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), texMat(t)); plate.position.set(0, 7.5, 0.72); grp.add(plate);
    // campus buildings set back on the right
    for (let i = 0; i < 3; i++) grp.add(box(10, 6 + i * 2, 8, col, 22 + i * 4, 3 + i, -10 - i * 12));
  } else if (kind === "park") {
    for (let i = 0; i < 10; i++) { const t = makeTree(); t.position.set(-10 - Math.random() * 10, 0, -20 + i * 4); t.scale.setScalar(1.4); grp.add(t); }
    const fence = box(0.15, 1.6, 40, 0x2b8a3e, -8.5, 0.8, 0); grp.add(fence);
    const t = textTexture([{ text: "سفاری پارک", font: "bold 50px sans-serif" }, { text: "SAFARI PARK", font: "bold 50px Poppins, sans-serif" }], 512, 220, "#2b6a2e");
    const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.2), texMat(t)); s.position.set(-8.5, 3, 0); s.rotation.y = Math.PI / 2; grp.add(s);
  } else if (id === "civic") {
    grp.add(box(14, 30, 14, 0xc9c2b2, 22, 15, -6));
    for (let f = 0; f < 9; f++) grp.add(box(14.1, 0.6, 14.1, 0x5c6b78, 22, 3 + f * 3.2, -6));
  } else if (id === "expo") {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe9ecef)); dome.position.set(26, 0, -4); grp.add(dome);
    grp.add(box(30, 4, 8, 0xced4da, 26, 2, 8));
  }
  grp.userData.name = name;
  return grp;
}

// ---------- mockup-inspired set pieces ----------
let brickTex: THREE.Texture | null = null;
function brick(color: string) {
  if (!brickTex) {
    const c = document.createElement("canvas"); c.width = 128; c.height = 128; const x = c.getContext("2d")!;
    x.fillStyle = "#e6d6bd"; x.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 5; k++) {
      x.fillStyle = `hsl(${24 + Math.random() * 8}, ${40 + Math.random() * 15}%, ${48 + Math.random() * 10}%)`;
      x.fillRect(k * 32 - (r % 2) * 16 + 1, r * 16 + 1, 30, 14);
    }
    brickTex = new THREE.CanvasTexture(c); brickTex.colorSpace = THREE.SRGBColorSpace;
    brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping; brickTex.repeat.set(2, 4);
  }
  const m = texMat(brickTex) as THREE.MeshStandardMaterial; m.color.set(color); return m;
}

/** Brick campus gate with an arch, round emblems and iron gates (NED / KU style). */
export function makeCampusGate(text: string, color: string) {
  const grp = new THREE.Group();
  const b = brick(color);
  for (const s of [-1, 1]) {
    grp.add(box(2.2, 7, 1.8, b, s * 6.2, 3.5, 0));
    grp.add(box(2.6, 0.4, 2.2, 0xe9dcc3, s * 6.2, 7.1, 0));
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), mat(0xf4ecdc)); emblem.position.set(s * 6.2, 4.6, 0.91); grp.add(emblem);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 20), mat(0x6b4a33)); ring.position.set(s * 6.2, 4.6, 0.92); grp.add(ring);
    for (const w of [-1, 1]) grp.add(box(2.4, 2.6, 0.4, b, s * 6.2 + w * 2.6, 1.3, 0)); // side walls
  }
  grp.add(box(10.2, 1.8, 1.4, b, 0, 7.6, 0));
  const t = textTexture([{ text, font: "bold 64px Poppins, sans-serif", color: "#2a1d12" }], 900, 120, "#efe3cc", "");
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 1.25), texMat(t)); plate.position.set(0, 7.6, 0.71); grp.add(plate);
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) grp.add(box(0.08, 3, 0.08, 0x2a2a2a, s * (0.4 + i * 0.55), 1.5, 0)); // iron bars
  for (const s of [-1, 1]) grp.add(box(4.9, 0.12, 0.1, 0x2a2a2a, s * 2.6, 2.9, 0));
  return grp;
}

/** Red & white "ROAD CLOSED" barricade. */
let closedTex: THREE.Texture | null = null;
export function makeRoadClosed() {
  closedTex ??= textTexture([{ text: "ROAD", font: "900 64px Poppins, sans-serif", color: "#111" }, { text: "CLOSED", font: "900 64px Poppins, sans-serif", color: "#111" }], 256, 200, "#f8f9fa", "#111");
  const grp = new THREE.Group();
  for (let i = 0; i < 6; i++) grp.add(box(0.36, 0.22, 0.08, i % 2 ? 0xffffff : 0xe03131, -0.9 + i * 0.36, 0.95, 0));
  for (let i = 0; i < 6; i++) grp.add(box(0.36, 0.22, 0.08, i % 2 ? 0xe03131 : 0xffffff, -0.9 + i * 0.36, 0.45, 0));
  for (const s of [-1, 1]) grp.add(box(0.08, 1.3, 0.5, 0xe03131, s * 1.05, 0.65, 0));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.95), texMat(closedTex)); sign.position.set(0, 1.75, 0.05); grp.add(sign);
  grp.add(box(0.06, 0.6, 0.06, 0x444444, 0, 1.3, 0));
  return grp;
}

/** A cluster of roadside pedestrians (scenery, no collision). */
export function makeCrowd(n = 5) {
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) { const p = makePerson(); p.position.set(Math.random() * 2.5, 0, (Math.random() - 0.5) * 5); p.rotation.y = Math.random() * Math.PI * 2; grp.add(p); }
  return grp;
}

/** Green construction hoarding panel like the BRT works fence. */
export function makeHoarding(len: number) {
  const grp = new THREE.Group();
  grp.add(box(0.12, 2.2, len, 0x2f7d4a, 0, 1.1, 0));
  for (let z = -len / 2; z <= len / 2; z += 2.5) grp.add(box(0.16, 2.3, 0.12, 0x9aa0a6, 0.05, 1.15, z));
  grp.add(box(0.14, 0.15, len, 0xe8e2c8, 0, 2.2, 0));
  return grp;
}

/** Concrete electric pole with cross arm; wires are drawn between poles by the caller. */
export function makePowerPole() {
  const grp = new THREE.Group();
  grp.add(box(0.25, 9, 0.25, 0x9d968a, 0, 4.5, 0));
  grp.add(box(2.2, 0.15, 0.15, 0x6c6c6c, 0, 8.5, 0));
  grp.add(box(0.5, 0.6, 0.4, 0x5c5c5c, 0.3, 6.5, 0)); // transformer box
  return grp;
}

/** The finished Red Line: elevated track on pillars with a green BRT bus. */
export function makeElevatedBRT(len: number) {
  const grp = new THREE.Group();
  grp.add(box(7, 0.8, len, 0xcfcac0, 0, 7.2, 0));
  for (const s of [-1, 1]) grp.add(box(0.25, 1.0, len, 0xb9b3a7, s * 3.4, 8.0, 0));
  for (let z = -len / 2; z <= len / 2; z += 18) { grp.add(box(1.6, 7, 1.6, 0xbdb7ab, 0, 3.5, z)); grp.add(box(4, 0.8, 2, 0xbdb7ab, 0, 6.6, z)); }
  const bus = new THREE.Group();
  bus.add(box(2.6, 2.6, 12, 0x2b9348, 0, 9.0, 0));
  bus.add(box(2.62, 0.9, 11.6, 0x1b2a35, 0, 9.5, 0));
  bus.add(box(2.64, 0.25, 12.02, 0xfcc419, 0, 8.3, 0));
  bus.position.z = -10; bus.name = "brtBus";
  grp.add(bus);
  return grp;
}
