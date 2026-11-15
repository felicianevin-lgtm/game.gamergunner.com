// MUD VALLEY RP: the country radio. Every song is made up by the game on the spot (WebAudio, no music files):
// a boom-chick bass, strummed chords, a twangy lead guitar, steel guitar slides, a fiddle on the old-time station and
// a little drum kit. Two stations. N (or the 📻 button) flips through them.
import { audioOut } from "./sfx.js";

export const STATIONS = [
  { name: "KMUD 98.7 Country", style: "boom" },
  { name: "Back Roads 101.1 Classic Country", style: "waltz" },
];
const TITLES = ["Tailgate Moonlight", "Red Dirt Road Home", "Muddy Boots Waltz", "Porch Light On", "Four-Wheel Heart", "Creek Bank Saturday", "Tractor Tire Swing", "Gravel in My Soul",
  "Hay Bale Sunset", "Old Truck, New Love", "Copper Creek Rain", "Back Forty Blues", "Diesel and Daisies", "Fence Post Prayer", "Cornfield Fireflies", "Half a Tank of Gas", "Mud Valley Morning", "Dirt Bike Summer"];
const ARTISTS = ["Dusty Ray & the Backroads", "Kaylee Mae", "The Gravel Brothers", "Big Creek Revival", "Wade Carver", "The Mudflap Kings", "Sadie Lynn", "Cody & the Cottonwoods"];
const DJ = ["That was {t} by {a}. Keep it muddy, Mud Valley!", "{a} with {t}. Watch out for those mud pits out there!", "You're listening to {s}. That was {t}.", "{t} from {a}. Wave at the cops, y'all!"];
const PROGS = [[0, 0, 3, 0, 4, 3, 0, 4], [0, 3, 4, 0, 0, 3, 4, 0], [0, 5, 3, 4, 0, 5, 3, 4], [0, 0, 3, 3, 4, 4, 0, 0], [0, 3, 0, 4, 0, 3, 4, 0]];
const KEYS = [196, 220, 246.94, 174.61, 164.81]; // G, A, B, F, E
const MAJ = [0, 2, 4, 5, 7, 9, 11], PENT = [0, 2, 4, 7, 9, 12, 14, 16];
const st = (f, n) => f * Math.pow(2, n / 12);

export class Radio {
  constructor(onSong) { this.on = -1; this.onSong = onSong; this.songN = Math.floor(Math.random() * 1000); this.timer = null; this.vol = 1; }
  get station() { return this.on >= 0 ? STATIONS[this.on] : null; }
  // off -> station 1 -> station 2 -> off
  cycle() {
    const A = audioOut(); if (!A) return null;
    this.on = this.on + 1 >= STATIONS.length ? -1 : this.on + 1;
    this.stop();
    if (this.on >= 0) this.start(A);
    return this.station;
  }
  setVolume(v) { this.vol = v; if (this.out) this.out.gain.setTargetAtTime(0.32 * v, this.ac.currentTime, 0.2); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; if (this.out) { const o = this.out; o.gain.setTargetAtTime(0, this.ac.currentTime, 0.05); setTimeout(() => o.disconnect(), 400); } this.out = null; }
  start(A) {
    const ac = this.ac = A.ac;
    this.out = ac.createGain(); this.out.gain.value = 0.32 * this.vol;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200; // (it's a car radio)
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 70;
    this.out.connect(hp); hp.connect(lp); lp.connect(A.master);
    this.static(ac.currentTime, 0.5);
    this.newSong(ac.currentTime + 0.5);
    this.timer = setInterval(() => this.pump(), 60);
  }
  newSong(t0) {
    const n = this.songN++, S = STATIONS[this.on];
    let sd = (n * 2654435761 + this.on * 97) >>> 0; const r = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    const waltz = S.style === "waltz", beats = waltz ? 3 : 4, bpm = waltz ? 96 + r() * 18 : 108 + r() * 22;
    const prog = PROGS[Math.floor(r() * PROGS.length)], chorus = PROGS[Math.floor(r() * PROGS.length)], root = KEYS[Math.floor(r() * KEYS.length)];
    const motif = (len) => { const m = []; let d = Math.floor(r() * 4); for (let i = 0; i < len; i++) { d = Math.max(0, Math.min(PENT.length - 1, d + Math.floor(r() * 5) - 2)); m.push(r() < 0.18 ? null : PENT[d]); } return m; };
    const parts = ["v", "v", "c", "v", "c", "o"], A = motif(beats * 2), B = motif(beats * 2), Cm = motif(beats * 2);
    this.song = { t0, beat: 0, spb: 60 / bpm, beats, waltz, root, bars: [], title: TITLES[n % TITLES.length], artist: ARTISTS[(n * 7 + 3) % ARTISTS.length] };
    for (const p of parts) {
      const pr = p === "c" ? chorus : prog, nb = p === "o" ? 4 : 8;
      for (let i = 0; i < nb; i++) this.song.bars.push({ ch: p === "o" && i === nb - 1 ? 0 : pr[i % 8], mel: p === "c" ? (i % 2 ? Cm : B) : i % 4 === 3 ? B : A, part: p, half: i % 2 });
    }
    this.song.total = this.song.bars.length * beats; this.song.dj = this.nextDj || null; this.nextDj = null;
    if (this.onSong) this.onSong(this.song, S);
  }
  pump() {
    if (!this.out || !this.song) return;
    const ac = this.ac, S = this.song;
    while (S.t0 + S.beat * S.spb < ac.currentTime + 0.3) {
      if (S.beat >= S.total) { // song over: a little static, the DJ talks, next song
        const t = S.t0 + S.beat * S.spb; this.static(t, 0.7);
        const dj = DJ[Math.floor(Math.random() * DJ.length)].replace("{t}", "“" + S.title + "”").replace("{a}", S.artist).replace("{s}", STATIONS[this.on].name);
        this.nextDj = dj; this.newSong(t + 1.2); return;
      }
      this.playBeat(S, S.beat, S.t0 + S.beat * S.spb);
      S.beat++;
    }
  }
  playBeat(S, k, t) {
    const bar = S.bars[Math.floor(k / S.beats)], b = k % S.beats, spb = S.spb;
    const deg = bar.ch, rootF = st(S.root, MAJ[deg % 7]) / (deg >= 3 ? 2 : 1), minor = deg === 5;
    const third = minor ? 3 : 4, chord = [0, third, 7, 12].map((n) => st(rootF * 2, n));
    const end = bar.part === "o" && k >= S.total - S.beats;
    // drums
    if (S.waltz) { if (b === 0) this.kick(t, 0.5); else this.brush(t, 0.18); }
    else { if (b === 0 || b === 2) this.kick(t, 0.6); else this.snare(t, 0.32); this.hat(t, 0.06); this.hat(t + spb / 2, 0.045); }
    // bass: root then the fifth (boom ... boom), with a walk-up at the end of some bars
    if (b === 0) this.bass(st(rootF, -12), t, spb * 0.9);
    else if (b === (S.waltz ? 1 : 2)) this.bass(st(rootF, -5), t, spb * 0.9);
    else if (!S.waltz && b === 3 && bar.half) this.bass(st(rootF, -10), t, spb * 0.45);
    // the "chick": a quick strum on the off beats
    if (S.waltz ? b > 0 : b % 2 === 1 || end) this.strum(chord, t, end ? spb * 3 : spb * 0.3, end ? 0.12 : 0.07);
    if (end) return;
    // lead guitar (verses) / steel guitar + fiddle (choruses)
    const steps = S.waltz ? 2 : 2, sub = spb / steps;
    for (let i = 0; i < steps; i++) {
      const n = bar.mel[(b * steps + i + bar.half * 3) % bar.mel.length]; if (n == null) continue;
      const f = st(S.root * 2, n);
      if (bar.part === "c") { if (i === 0) { this.steel(f, t, spb * 0.95); if (S.waltz) this.fiddle(st(f, 12), t, spb * 0.9); } }
      else if (S.waltz) { if (i === 0) this.fiddle(st(f, 12), t, spb * 0.9); }
      else this.twang(st(f, 12), t + i * sub, sub * 0.95, Math.random() < 0.25);
    }
  }
  // ---- instruments
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  osc(type, f, t, len, peak, a = 0.005, filt) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    this.env(g, t, a, peak, len); let n = o; if (filt) { n.connect(filt); n = filt; } n.connect(g); g.connect(this.out); o.start(t); o.stop(t + a + len + 0.05); return o;
  }
  bass(f, t, len) { this.osc("triangle", f, t, len, 0.55, 0.008); this.osc("sine", f, t, len * 0.6, 0.3); }
  strum(ch, t, len, vol) {
    const ac = this.ac;
    ch.forEach((f, i) => { const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(700, t + len); this.osc("sawtooth", f, t + i * 0.012, len, vol, 0.004, lp); });
  }
  twang(f, t, len, bend) {
    const ac = this.ac, lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 6; lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(900, t + len);
    const o = this.osc("square", bend ? st(f, -2) : f, t, len, 0.13, 0.003, lp); if (bend) o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  }
  steel(f, t, len) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(this.lastSteel || f, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); this.lastSteel = f;
    lfo.frequency.value = 5.2; lg.gain.value = f * 0.008; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.2);
    const o2 = ac.createOscillator(); o2.type = "triangle"; o2.frequency.setValueAtTime(f * 2, t); const g2 = ac.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g);
    o.connect(g); g.connect(this.out); for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len + 0.3); }
  }
  fiddle(f, t, len) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 1.2;
    lfo.frequency.value = 6; lg.gain.value = f * 0.01; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.06); g.gain.setValueAtTime(0.1, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(bp); bp.connect(g); g.connect(this.out); for (const x of [o, lfo]) { x.start(t); x.stop(t + len + 0.05); }
  }
  noiseBuf() { if (!this.nb) { const ac = this.ac, b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.nb = b; } return this.nb; }
  noise(t, len, vol, type, f) {
    const ac = this.ac, n = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = this.noiseBuf(); fl.type = type; fl.frequency.value = f;
    this.env(g, t, 0.002, vol, len); n.connect(fl); fl.connect(g); g.connect(this.out); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
  }
  kick(t, v) { const o = this.osc("sine", 120, t, 0.22, v); o.frequency.exponentialRampToValueAtTime(42, t + 0.15); }
  snare(t, v) { this.noise(t, 0.14, v, "bandpass", 1900); this.osc("triangle", 190, t, 0.06, v * 0.4); }
  brush(t, v) { this.noise(t, 0.2, v, "bandpass", 3200); }
  hat(t, v) { this.noise(t, 0.04, v, "highpass", 7000); }
  static(t, len) { if (this.out) this.noise(t, len, 0.12, "bandpass", 2400); }
}
