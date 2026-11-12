// MUD VALLEY RP sounds, all made in code with WebAudio (no sound files!): engine hum, horn, cash register, splashes...
let ac = null, master = null, muted = false;
let eng = null; // the engine sound (always running quietly while you drive)
export function audio() {
  try {
    if (!ac) {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null; // (browsers only allow sound after a tap or key)
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.7;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
  } catch {}
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ac.currentTime, 0.03); }
export const isMuted = () => muted;

function tone(f, len, type = "square", slide = 0, vol = 0.5, delay = 0) {
  if (!ac || muted) return;
  try {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05);
  } catch {}
}
let nbuf = null;
function nb() { if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
function noise(len, freq, vol = 0.5, type = "lowpass", delay = 0, sweep = 0) {
  if (!ac || muted) return;
  try {
    const t = ac.currentTime + delay, n = ac.createBufferSource(); n.buffer = nb();
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + len); f.Q.value = type === "bandpass" ? 1.5 : 0.7;
    const g = ac.createGain(); g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
  } catch {}
}

export const SFX = {
  click() { tone(900, 0.05, "square", 0, 0.18); },
  nope() { tone(220, 0.16, "square", 150, 0.3); },
  cash() { noise(0.05, 4000, 0.5, "highpass"); [1318, 1568, 2093].forEach((f, i) => tone(f, 0.35, "triangle", 0, 0.35, 0.05 + i * 0.07)); tone(2637, 0.5, "sine", 0, 0.25, 0.26); },
  buy() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, "square", 0, 0.22, i * 0.07)); tone(1318, 0.5, "triangle", 0, 0.3, 0.3); },
  horn() { tone(370, 0.45, "sawtooth", 0, 0.28); tone(466, 0.45, "sawtooth", 0, 0.22); },
  hornBig() { tone(185, 0.8, "sawtooth", 0, 0.3); tone(233, 0.8, "sawtooth", 0, 0.25); tone(277, 0.8, "sawtooth", 0, 0.2); },
  door() { noise(0.08, 500, 0.5); tone(120, 0.08, "square", 80, 0.3); },
  start() { noise(0.4, 300, 0.4, "lowpass", 0, 900); tone(60, 0.5, "sawtooth", 120, 0.25); },
  land(k = 1) { noise(0.18, 300, Math.min(0.9, 0.3 + k * 0.05)); tone(90, 0.15, "sine", 50, Math.min(0.7, k * 0.06)); },
  crash(k = 1) { noise(0.35, 1400, Math.min(1, 0.4 + k * 0.04), "lowpass", 0, 200); tone(140, 0.3, "square", 60, Math.min(0.6, k * 0.04)); },
  splash() { noise(0.6, 3000, 0.7, "bandpass", 0, 600); noise(0.3, 800, 0.4); },
  squish() { noise(0.25, 400, 0.5, "lowpass", 0, 150); },
  hitch() { tone(1800, 0.06, "square", 0, 0.2); tone(1200, 0.08, "square", 0, 0.2, 0.06); noise(0.06, 3000, 0.3, "highpass"); },
  load() { [300, 400, 500].forEach((f, i) => tone(f, 0.1, "square", 0, 0.2, i * 0.08)); noise(0.2, 900, 0.3); },
  wash() { noise(1.6, 2500, 0.6, "bandpass", 0, 6000); noise(1.6, 700, 0.3, "lowpass"); [784, 988, 1318].forEach((f, i) => tone(f, 0.2, "sine", 0, 0.2, 1.4 + i * 0.08)); },
  beep() { tone(660, 0.18, "square", 0, 0.3); },
  go() { tone(990, 0.5, "square", 0, 0.35); tone(1320, 0.5, "triangle", 0, 0.25); },
  check() { tone(880, 0.1, "square", 0, 0.25); tone(1320, 0.18, "square", 0, 0.25, 0.08); },
  lap() { [659, 880, 1046].forEach((f, i) => tone(f, 0.14, "square", 0, 0.25, i * 0.08)); },
  win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, "square", 0, 0.25, i * 0.11)); tone(1568, 0.7, "triangle", 0, 0.35, 0.8); },
  lose() { [523, 466, 392].forEach((f, i) => tone(f, 0.25, "triangle", 0, 0.3, i * 0.18)); },
  job() { [440, 554, 659].forEach((f, i) => tone(f, 0.12, "triangle", 0, 0.3, i * 0.07)); },
  pickup() { tone(700, 0.08, "square", 0, 0.25); tone(1050, 0.12, "square", 0, 0.25, 0.07); },
  air() { tone(500, 0.3, "triangle", 1200, 0.25); },
  flip() { noise(0.35, 800, 0.4, "bandpass", 0, 2500); tone(200, 0.3, "triangle", 500, 0.2); },
  step() { noise(0.04, 600, 0.12); },
  jump() { tone(300, 0.15, "square", 600, 0.18); },
  phone() { tone(1046, 0.06, "sine", 0, 0.25); tone(1568, 0.08, "sine", 0, 0.25, 0.07); },
  // blasters, robbers + cops
  zap(k = 0) { tone(1400 - k * 200, 0.14, "square", 300, 0.22); noise(0.08, 3000, 0.25, "bandpass"); },
  splat() { noise(0.12, 900, 0.45, "lowpass", 0, 300); tone(260, 0.08, "sine", 120, 0.25); },
  stun() { [880, 660, 990, 740].forEach((f, i) => tone(f, 0.09, "triangle", 0, 0.22, i * 0.07)); },
  bonk() { tone(520, 0.12, "sine", 180, 0.4); noise(0.06, 2000, 0.3); },
  alarm() { for (let i = 0; i < 4; i++) { tone(880, 0.16, "square", 0, 0.22, i * 0.34); tone(660, 0.16, "square", 0, 0.22, i * 0.34 + 0.17); } },
  radio() { noise(0.12, 2500, 0.3, "bandpass"); tone(1200, 0.06, "square", 0, 0.15, 0.12); tone(900, 0.06, "square", 0, 0.15, 0.2); noise(0.2, 2500, 0.2, "bandpass", 0.28); },
  cuff() { tone(2200, 0.04, "square", 0, 0.2); tone(1800, 0.05, "square", 0, 0.2, 0.06); tone(2400, 0.04, "square", 0, 0.2, 0.14); },
  busted() { [523, 415, 330, 262].forEach((f, i) => tone(f, 0.28, "square", 0, 0.25, i * 0.2)); },
  jail() { noise(0.4, 300, 0.6, "lowpass"); tone(90, 0.4, "square", 60, 0.35); },
  escape() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, "square", 0, 0.22, i * 0.07)); },
  drill() { noise(0.25, 3500, 0.25, "bandpass"); tone(180 + Math.random() * 40, 0.25, "sawtooth", 0, 0.12); },
  pry() { tone(140, 0.1, "sawtooth", 90, 0.25); noise(0.08, 1500, 0.2, "bandpass"); },
  smash() { noise(0.3, 5000, 0.6, "highpass", 0, 2000); [2637, 3136, 2349].forEach((f, i) => tone(f, 0.12, "triangle", 0, 0.12, i * 0.05)); },
  spikes() { tone(300, 0.08, "square", 0, 0.2); noise(0.2, 1200, 0.3); },
  pop() { noise(0.15, 2500, 0.7, "bandpass", 0, 400); tone(200, 0.2, "sawtooth", 60, 0.3); },
  // fishing
  cast() { noise(0.35, 4000, 0.25, "bandpass", 0, 1500); tone(900, 0.3, "sine", 300, 0.12); },
  plop() { tone(500, 0.12, "sine", 160, 0.4); noise(0.18, 1400, 0.3, "lowpass", 0.02); },
  bite() { tone(1046, 0.08, "square", 0, 0.3); tone(1046, 0.08, "square", 0, 0.3, 0.12); },
  reel() { tone(2600 + Math.random() * 400, 0.025, "square", 0, 0.08); },
  snap() { noise(0.12, 4000, 0.5, "highpass"); tone(300, 0.2, "triangle", 120, 0.3); },
  fish() { [659, 784, 988, 1318].forEach((f, i) => tone(f, 0.14, "triangle", 0, 0.3, i * 0.08)); noise(0.3, 1800, 0.25, "bandpass"); },
};
// ---- a police siren (wee-ooo wee-ooo). vol 0 = off
let sir = null;
export function siren(vol = 0) {
  if (!ac) return;
  try {
    if (!sir) {
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
      o.type = "triangle"; o.frequency.value = 900; lfo.type = "triangle"; lfo.frequency.value = 0.9; lg.gain.value = 320;
      lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.gain.value = 0; g.connect(master); o.start(); lfo.start();
      sir = { o, g };
    }
    sir.g.gain.setTargetAtTime(muted ? 0 : Math.min(0.12, vol * 0.12), ac.currentTime, 0.08);
  } catch {}
}

// ---- the engine: two buzzing oscillators through a filter, plus a rumble and a skid hiss
export function engine(on, rpm = 0, thr = 0, base = 80, slip = 0, rough = 0) {
  if (!ac) return;
  try {
    if (!eng) {
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = "sawtooth"; o2.type = "square"; f.type = "lowpass"; f.Q.value = 2;
      o1.connect(f); o2.connect(f); f.connect(g); g.gain.value = 0; g.connect(master);
      const n = ac.createBufferSource(); n.buffer = nb(); n.loop = true; const nf = ac.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 1500; nf.Q.value = 0.9; const ng = ac.createGain(); ng.gain.value = 0;
      n.connect(nf); nf.connect(ng); ng.connect(master);
      const r = ac.createBufferSource(); r.buffer = nb(); r.loop = true; const rf = ac.createBiquadFilter(); rf.type = "lowpass"; rf.frequency.value = 220; const rg = ac.createGain(); rg.gain.value = 0;
      r.connect(rf); rf.connect(rg); rg.connect(master);
      o1.start(); o2.start(); n.start(); r.start();
      eng = { o1, o2, f, g, ng, rg };
    }
    const t = ac.currentTime, k = 0.06;
    const fr = base * (0.55 + rpm * 1.3);
    eng.o1.frequency.setTargetAtTime(fr, t, k); eng.o2.frequency.setTargetAtTime(fr * 0.5, t, k);
    eng.f.frequency.setTargetAtTime(300 + rpm * 900 + thr * 600, t, k);
    eng.g.gain.setTargetAtTime(on && !muted ? 0.05 + thr * 0.05 + rpm * 0.03 : 0, t, 0.1);
    eng.ng.gain.setTargetAtTime(on && !muted ? Math.min(0.18, slip * 0.02) : 0, t, 0.08);
    eng.rg.gain.setTargetAtTime(on && !muted ? Math.min(0.5, rough) : 0, t, 0.1);
  } catch {}
}
