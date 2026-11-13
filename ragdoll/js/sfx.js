// SPLAT LAB sounds, all made in code with WebAudio (no sound files): thuds, splats, bangs, booms, slices...
let ac = null, master = null, muted = false;
const last = {};
export function audio() {
  try {
    if (!ac) {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null; // (sound only after a tap or key)
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.6;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
      master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
  } catch {}
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.6, ac.currentTime, 0.03); }
export const isMuted = () => muted;
// (the same sound at most every `gap` seconds, so 20 things landing at once don't blast your ears)
function ok(name, gap) { if (!ac || muted) return false; const t = ac.currentTime; if (last[name] && t - last[name] < gap) return false; last[name] = t; return true; }

function tone(f, len, type = "square", slide = 0, vol = 0.5, delay = 0) {
  try {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.2, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05);
  } catch {}
}
let nbuf = null;
function nb() { if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
function noise(len, freq, vol = 0.5, type = "lowpass", delay = 0, sweep = 0) {
  try {
    const t = ac.currentTime + delay, n = ac.createBufferSource(); n.buffer = nb();
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + len); f.Q.value = type === "bandpass" ? 1.4 : 0.7;
    const g = ac.createGain(); g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
  } catch {}
}

export const SFX = {
  click() { if (ok("click", 0.03)) tone(900, 0.05, "square", 0, 0.15); },
  spawn() { if (ok("spawn", 0.05)) { tone(520, 0.07, "triangle", 780, 0.3); noise(0.06, 2000, 0.15, "bandpass"); } },
  thud(v = 1) { if (ok("thud", 0.06)) { noise(0.12 + v * 0.1, 200 + v * 200, Math.min(1, 0.25 + v * 0.5)); tone(90, 0.15, "sine", 45, Math.min(0.7, v * 0.5)); } },
  clank(v = 1) { if (ok("clank", 0.07)) { tone(700 + Math.random() * 500, 0.12, "triangle", 400, 0.3 * v); noise(0.06, 4000, 0.25 * v, "highpass"); } },
  splat(v = 1) { if (ok("splat", 0.05)) { noise(0.18, 900, Math.min(0.9, 0.3 + v * 0.4), "lowpass", 0, 200); tone(140, 0.1, "sine", 70, 0.25); } },
  slice() { if (ok("slice", 0.05)) { noise(0.12, 5000, 0.45, "bandpass", 0, 1500); tone(1800, 0.06, "sawtooth", 900, 0.12); } },
  crunch() { if (ok("crunch", 0.08)) { noise(0.08, 1800, 0.7, "bandpass"); noise(0.05, 900, 0.6, "bandpass", 0.04); tone(220, 0.05, "square", 90, 0.3); } },
  rip() { if (ok("rip", 0.08)) { noise(0.25, 1400, 0.8, "bandpass", 0, 400); this.splat(1.2); } },
  pop() { if (ok("pop", 0.06)) { noise(0.3, 700, 1, "lowpass", 0, 120); tone(260, 0.12, "sine", 60, 0.6); } },
  shot(kind = 0) { if (!ok("shot" + kind, 0.03)) return; if (kind === 3) { noise(0.5, 1600, 1, "lowpass", 0, 120); tone(70, 0.4, "sawtooth", 30, 0.7); } else if (kind === 2) { noise(0.32, 2200, 1, "lowpass", 0, 200); tone(110, 0.2, "square", 50, 0.5); } else { noise(0.12 + kind * 0.03, 3200, 0.9, "lowpass", 0, 400); tone(300, 0.06, "square", 90, 0.4); } },
  ric() { if (ok("ric", 0.08)) tone(2400 + Math.random() * 1500, 0.18, "sine", 900, 0.15); },
  hitBody() { if (ok("hitb", 0.04)) { noise(0.08, 700, 0.6); tone(160, 0.06, "sine", 80, 0.3); } },
  boom(p = 1) { if (!ok("boom", 0.05)) return; noise(1.2 * p, 900, 1, "lowpass", 0, 60); tone(60, 0.9, "sine", 25, 0.9); noise(0.25, 3000, 0.5, "bandpass", 0, 300); },
  fire() { if (ok("fire", 0.25)) noise(0.5, 1200, 0.3, "bandpass", 0, 500); },
  whoosh() { if (ok("whoosh", 0.1)) noise(0.4, 600, 0.5, "bandpass", 0, 2400); },
  beep() { if (ok("beep", 0.05)) tone(1600, 0.06, "square", 0, 0.25); },
  saw() { if (ok("saw", 0.09)) { noise(0.1, 2500, 0.4, "bandpass"); tone(330, 0.1, "sawtooth", 300, 0.15); } },
  crush() { if (ok("crush", 0.15)) { noise(0.4, 400, 1, "lowpass", 0, 80); tone(55, 0.4, "square", 30, 0.6); } },
  heal() { [523, 784, 1046].forEach((f, i) => tone(f, 0.14, "triangle", 0, 0.25, i * 0.06)); },
  engine() { if (ok("eng", 0.12)) tone(70 + Math.random() * 20, 0.14, "sawtooth", 60, 0.1); },
  ko() { if (ok("ko", 0.2)) [1568, 1318, 1175].forEach((f, i) => tone(f, 0.18, "sine", 0, 0.18, i * 0.08)); },
  die() { if (ok("die", 0.2)) tone(400, 0.5, "triangle", 120, 0.25); },
};
