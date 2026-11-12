// BONK BRAWLERS sounds, all made in code with WebAudio (no sound files!): punches, kicks, blocks, zaps, the KO bell...
let ac = null, master = null, muted = false;
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
  pick() { tone(660, 0.08, "square", 0, 0.25); tone(990, 0.12, "square", 0, 0.25, 0.07); },
  nope() { tone(220, 0.16, "square", 150, 0.3); },
  whiff() { noise(0.09, 1800, 0.25, "bandpass", 0, 700); },
  whiffBig() { noise(0.16, 1200, 0.35, "bandpass", 0, 400); },
  hitL() { noise(0.07, 2200, 0.7); tone(320, 0.07, "square", 160, 0.35); },
  hitH() { noise(0.16, 1200, 0.9, "lowpass", 0, 200); tone(150, 0.18, "square", 60, 0.55); tone(90, 0.2, "sine", 45, 0.6); },
  boing() { tone(300, 0.25, "sine", 900, 0.4); tone(600, 0.2, "triangle", 300, 0.2, 0.12); },
  block() { tone(1400, 0.06, "square", 900, 0.25); noise(0.05, 5000, 0.35, "highpass"); },
  jump() { tone(260, 0.12, "sine", 520, 0.22); },
  land() { noise(0.1, 300, 0.35); },
  thud() { noise(0.3, 260, 0.9); tone(80, 0.3, "sine", 40, 0.6); },
  zap() { tone(880, 0.25, "sawtooth", 220, 0.25); noise(0.15, 3000, 0.25, "bandpass"); },
  throw() { noise(0.12, 900, 0.35, "bandpass", 0, 2500); tone(500, 0.12, "triangle", 300, 0.2); },
  dash() { noise(0.25, 600, 0.45, "bandpass", 0, 2400); },
  rise() { tone(300, 0.3, "square", 1200, 0.25); noise(0.2, 1500, 0.3, "bandpass", 0, 4000); },
  pop() { tone(700, 0.08, "sine", 200, 0.35); noise(0.06, 1200, 0.3); },
  meter() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, "square", 0, 0.2, i * 0.06)); },
  super() { tone(110, 0.9, "sawtooth", 440, 0.35); noise(0.9, 400, 0.4, "lowpass", 0, 4000); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "square", 0, 0.22, 0.3 + i * 0.07)); },
  tick() { tone(1200, 0.04, "square", 0, 0.12); },
  bell() { [880, 1320].forEach((f) => tone(f, 0.9, "triangle", 0, 0.35)); tone(1760, 0.6, "sine", 0, 0.2); },
  ready() { tone(523, 0.16, "square", 0, 0.3); tone(523, 0.16, "square", 0, 0.3, 0.25); },
  fight() { tone(784, 0.4, "square", 0, 0.35); tone(1046, 0.45, "triangle", 0, 0.3, 0.05); noise(0.3, 2000, 0.3, "bandpass"); },
  ko() { tone(600, 0.9, "square", 80, 0.4); noise(0.6, 500, 0.6, "lowpass", 0, 100); [1568, 1318, 1175].forEach((f, i) => tone(f, 0.3, "sine", 0, 0.3, 0.5 + i * 0.12)); },
  dizzy() { [1800, 2100, 1600, 2400].forEach((f, i) => tone(f, 0.08, "sine", 0, 0.15, i * 0.09)); },
  win() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.2, "square", 0, 0.25, i * 0.11)); tone(1318, 0.7, "triangle", 0, 0.3, 0.66); },
  cheer() { noise(1.4, 1600, 0.35, "bandpass", 0, 2600); noise(1.2, 3000, 0.2, "highpass", 0.1); },
};
