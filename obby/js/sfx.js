// MEGA OBBY: little made-up sounds (no sound files).
let ac = null, master = null, muted = false;
export function audio() { if (ac) { if (ac.state === "suspended") ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); } catch {} }
export function setMuted(m) { muted = m; }
const last = {};
function tone(f, d, type = "square", vol = 0.2, slide = 0, delay = 0, key = "") {
  if (!ac || muted) return; const now = ac.currentTime; if (key) { if (last[key] && now - last[key] < 0.05) return; last[key] = now; }
  try {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, now + delay); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), now + delay + d);
    g.gain.setValueAtTime(vol, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + d); o.connect(g); g.connect(master); o.start(now + delay); o.stop(now + delay + d + 0.02);
  } catch {}
}
function noise(d, vol = 0.2, lp = 1200, key = "") {
  if (!ac || muted) return; const now = ac.currentTime; if (key) { if (last[key] && now - last[key] < 0.06) return; last[key] = now; }
  try {
    const b = ac.createBuffer(1, Math.floor(ac.sampleRate * d), ac.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = "lowpass"; f.frequency.value = lp; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start();
  } catch {}
}
export const SFX = {
  jump: () => tone(380, 0.12, "square", 0.08, 1.8, 0, "jump"),
  land: () => noise(0.08, 0.12, 500, "land"),
  step: () => tone(110, 0.03, "sine", 0.05, 1, 0, "step"),
  die: () => { tone(500, 0.35, "sawtooth", 0.12, 0.25); noise(0.25, 0.12, 900); },
  check: () => [523, 659, 784].forEach((f, i) => tone(f, 0.14, "square", 0.1, 1, i * 0.07)),
  zone: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "square", 0.1, 1, i * 0.09)),
  win: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.3, "square", 0.12, 1, i * 0.12)); noise(1, 0.1, 5000); },
  bounce: () => tone(220, 0.25, "sine", 0.18, 3.5, 0, "bounce"),
  crumble: () => noise(0.25, 0.1, 1600, "crumble"),
  vanish: () => tone(900, 0.12, "triangle", 0.08, 0.5, 0, "vanish"),
  push: () => { noise(0.35, 0.22, 2500, "push"); tone(200, 0.3, "sine", 0.15, 3); },
  pushed: () => { noise(0.4, 0.2, 1800); tone(700, 0.4, "sawtooth", 0.1, 0.3); },
  carpet: () => [660, 880, 990, 1320].forEach((f, i) => tone(f, 0.22, "sine", 0.1, 1, i * 0.06)),
  click: () => tone(700, 0.04, "square", 0.08),
  nope: () => tone(150, 0.15, "square", 0.12),
};
