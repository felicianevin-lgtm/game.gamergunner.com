// TURBO DASH sounds and music, all made in code with WebAudio.
let ac = null, master = null, sfxBus = null, musBus = null, muted = false;
export function audio() {
  try {
    if (!ac) {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null; // (browsers only allow sound after a tap or key)
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.7;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      musBus = ac.createGain(); musBus.gain.value = 0; musBus.connect(master);
    }
    if (ac.state === "suspended") ac.resume();
  } catch {}
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ac.currentTime, 0.03); }

function tone(f, len, type = "square", slide = 0, vol = 0.5, delay = 0, bus = sfxBus) {
  if (!ac || muted) return;
  try {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.2, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + len + 0.05);
  } catch {}
}
let nbuf = null;
function noise(len, freq, vol = 0.5, type = "lowpass", delay = 0, sweep = 0, bus = sfxBus, at = 0) {
  if (!ac || muted) return;
  try {
    if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = at || ac.currentTime + delay, n = ac.createBufferSource(); n.buffer = nbuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + len); f.Q.value = type === "bandpass" ? 1.5 : 0.7;
    const g = ac.createGain(); g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
  } catch {}
}

export const SFX = {
  coin(streak = 0) { const f = 988 * Math.pow(2, Math.min(streak, 14) / 12); tone(f, 0.09, "square", 0, 0.22); tone(f * 1.5, 0.16, "sine", 0, 0.35, 0.05); },
  jump(big) { tone(big ? 260 : 320, 0.2, "square", big ? 900 : 700, 0.28); noise(0.08, 900, 0.25); },
  land() { noise(0.07, 400, 0.35); },
  slide() { noise(0.35, 2500, 0.45, "bandpass", 0, 500); },
  dive() { tone(700, 0.12, "triangle", 200, 0.3); },
  whoosh(dir) { noise(0.16, dir > 0 ? 1400 : 1100, 0.4, "bandpass", 0, dir > 0 ? 3200 : 2600); },
  bonk() { tone(140, 0.12, "square", 90, 0.35); },
  power() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, "square", 0, 0.25, i * 0.05)); tone(1568, 0.4, "sine", 0, 0.3, 0.25); },
  powerEnd() { [784, 659, 523].forEach((f, i) => tone(f, 0.12, "triangle", 0, 0.25, i * 0.06)); },
  jet() { noise(0.9, 600, 0.6, "lowpass", 0, 2400); tone(90, 0.8, "sawtooth", 200, 0.2); },
  shield() { tone(1200, 0.4, "sine", 300, 0.5); noise(0.4, 3000, 0.5, "highpass"); [880, 1175].forEach((f, i) => tone(f, 0.2, "square", 0, 0.2, 0.08 + i * 0.07)); },
  stumble() { tone(300, 0.25, "square", 120, 0.4); noise(0.2, 600, 0.5); tone(660, 0.12, "square", 0, 0.25, 0.3); tone(440, 0.12, "square", 0, 0.25, 0.42); },
  robot() { [523, 392, 523, 392].forEach((f, i) => tone(f, 0.12, "square", 0, 0.18, i * 0.14)); },
  crash() { noise(0.7, 1800, 0.9, "lowpass", 0, 200); tone(180, 0.6, "sawtooth", 40, 0.6); tone(90, 0.5, "square", 30, 0.4, 0.05); },
  caught() { tone(880, 0.15, "square", 0, 0.3); tone(660, 0.15, "square", 0, 0.3, 0.15); tone(440, 0.4, "square", 220, 0.3, 0.3); noise(0.4, 900, 0.4, "bandpass", 0.3); },
  mission() { [659, 784, 988, 1318].forEach((f, i) => tone(f, 0.22, "square", 0, 0.25, i * 0.09)); tone(1568, 0.5, "triangle", 0, 0.35, 0.36); },
  horn() { tone(330, 0.5, "sawtooth", 0, 0.22); tone(415, 0.5, "sawtooth", 0, 0.18); },
  theme() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, "triangle", 0, 0.3, i * 0.1)); },
  click() { tone(900, 0.05, "square", 0, 0.2); },
  buy() { [784, 1046, 1318].forEach((f, i) => tone(f, 0.12, "square", 0, 0.25, i * 0.06)); },
  nope() { tone(200, 0.18, "square", 150, 0.3); },
};

// ---- the music: an upbeat loop (drums, bass, arpeggio), a new key for every world
const BPM = 134, S16 = 60 / BPM / 4;
const PROG = [[0, "M"], [-3, "m"], [-7, "M"], [-5, "M"]]; // I vi IV V
const KEYS = [0, 2, 5, -3];
let timer = null, nextT = 0, stepN = 0, key = 0, intensity = 0;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function note(f, t, len, type, vol, cutoff) {
  try {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
    let last = o;
    if (cutoff) { const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = cutoff; o.connect(fl); last = fl; }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    last.connect(g); g.connect(musBus); o.start(t); o.stop(t + len + 0.05);
  } catch {}
}
function schedule() {
  if (!ac) return;
  while (nextT < ac.currentTime + 0.15) {
    const s = stepN % 16, bar = Math.floor(stepN / 16) % 4, t = nextT;
    const [root, q] = PROG[bar], base = 45 + KEYS[key] + root; // A2-ish
    const third = q === "M" ? 4 : 3;
    if (s % 4 === 0) { try { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.2); } catch {} }
    if (s % 4 === 2) noise(0.04, 7000, 0.35, "highpass", 0, 0, musBus, t);
    if (s === 4 || s === 12) noise(0.14, 1800, 0.5, "bandpass", 0, 0, musBus, t);
    if (s % 2 === 0) note(mtof(base + (s % 4 === 2 ? 12 : 0)), t, S16 * 1.6, "sawtooth", 0.16, 700);
    const arp = [0, third, 7, 12, 7, third, 12, 7 + 12][s % 8];
    note(mtof(base + 24 + arp), t, S16 * 0.9, s % 2 ? "triangle" : "square", intensity > 0.5 ? 0.05 : 0.035);
    if (intensity > 0.3 && (s === 0 || s === 6 || s === 10)) note(mtof(base + 36 + [0, third, 7][(s / 4) | 0]), t, S16 * 3, "triangle", 0.05);
    nextT += S16; stepN++;
  }
}
export function music(on, k = key) {
  if (!audio()) return;
  key = k;
  if (on) {
    if (!timer) { nextT = ac.currentTime + 0.05; timer = setInterval(schedule, 25); }
    musBus.gain.setTargetAtTime(0.55, ac.currentTime, 0.2);
  } else {
    musBus.gain.setTargetAtTime(0, ac.currentTime, 0.12);
    if (timer) { clearInterval(timer); timer = null; }
  }
}
export function musicKey(k) { key = k; }
export function musicIntensity(v) { intensity = v; }
