import { save } from "../state";

// All sounds are synthesized with Web Audio, so the app ships no audio files.
class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  engineOsc?: OscillatorNode; engineGain?: GainNode; engineLfo?: OscillatorNode; engineFilter?: BiquadFilterNode;
  musicTimer = 0; musicStep = 0;

  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ctx.destination);
  }

  private noise(dur: number) {
    const c = this.ctx!, b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slide = 0) {
    if (!this.ctx || !save.settings.sound) return;
    const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  startEngine() {
    if (!this.ctx || this.engineOsc || !save.settings.sound) return;
    const c = this.ctx;
    this.engineOsc = c.createOscillator(); this.engineOsc.type = "sawtooth"; this.engineOsc.frequency.value = 45;
    this.engineFilter = c.createBiquadFilter(); this.engineFilter.type = "lowpass"; this.engineFilter.frequency.value = 500;
    this.engineGain = c.createGain(); this.engineGain.gain.value = 0.08;
    // 4-stroke "putt putt": amplitude-modulate with a square LFO
    this.engineLfo = c.createOscillator(); this.engineLfo.type = "square"; this.engineLfo.frequency.value = 12;
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.05;
    this.engineLfo.connect(lfoGain).connect(this.engineGain.gain);
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start(); this.engineLfo.start();
  }
  setEngine(speed: number) {
    if (!this.engineOsc || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(40 + speed * 4.5, t, 0.1);
    this.engineLfo!.frequency.setTargetAtTime(8 + speed * 1.1, t, 0.1);
    this.engineFilter!.frequency.setTargetAtTime(350 + speed * 30, t, 0.1);
  }
  stopEngine() {
    this.engineOsc?.stop(); this.engineLfo?.stop();
    this.engineOsc = this.engineLfo = undefined;
  }

  horn() { this.tone(415, 0.45, "square", 0.12); this.tone(523, 0.45, "square", 0.1); }
  coin() { this.tone(988, 0.08, "square", 0.06); this.tone(1319, 0.15, "square", 0.06, 0.06); }
  powerup() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.12, i * 0.07)); }
  jump() { this.tone(200, 0.25, "triangle", 0.15, 0, 500); }
  crash(big = false) {
    if (!this.ctx || !save.settings.sound) return;
    const c = this.ctx, n = this.noise(big ? 0.6 : 0.3), f = c.createBiquadFilter(), g = c.createGain();
    f.type = "lowpass"; f.frequency.value = big ? 900 : 1500;
    g.gain.setValueAtTime(0.5, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (big ? 0.6 : 0.3));
    n.connect(f).connect(g).connect(this.master); n.start();
    this.tone(90, 0.3, "sine", 0.4, 0, 40);
  }
  splash() {
    if (!this.ctx || !save.settings.sound) return;
    const c = this.ctx, n = this.noise(0.5), f = c.createBiquadFilter(), g = c.createGain();
    f.type = "bandpass"; f.frequency.value = 2500;
    g.gain.setValueAtTime(0.35, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    n.connect(f).connect(g).connect(this.master); n.start();
  }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.14, i * 0.1)); }

  // Light looping tune on a desi-flavoured scale (Raag Bhairav-ish).
  musicTick(dt: number) {
    if (!this.ctx || !save.settings.music || !save.settings.sound) return;
    this.musicTimer -= dt; if (this.musicTimer > 0) return;
    this.musicTimer = 0.22;
    const scale = [261.6, 277.2, 329.6, 349.2, 392, 415.3, 493.9, 523.3];
    const pat = [0, 2, 4, 5, 4, 2, 1, 0, 4, 5, 7, 6, 5, 4, 2, 3];
    const s = this.musicStep++ % pat.length;
    this.tone(scale[pat[s]], 0.2, "triangle", 0.035);
    if (s % 4 === 0) this.tone(scale[0] / 2, 0.4, "sine", 0.06);
  }
}
export const audio = new Audio();
