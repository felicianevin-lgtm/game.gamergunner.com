// CIRCUIT SIEGE: little made-up sounds (no sound files): pew, zap, boom, coins, crate opening...
let ac = null, master = null, muted = false;
export function audio() { if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); } catch {} }
export function setMuted(m) { muted = m; }
let last = {};
function tone(f, d, type = "square", vol = 0.2, slide = 0, delay = 0, key = "") {
  if (!ac || muted) return; const now = ac.currentTime; if (key) { if (last[key] && now - last[key] < 0.04) return; last[key] = now; }
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
  pew: () => tone(880, 0.07, "square", 0.05, 0.5, 0, "pew"),
  laser: () => tone(1400, 0.06, "sawtooth", 0.04, 0.6, 0, "laser"),
  zap: () => { tone(300, 0.12, "sawtooth", 0.06, 3, 0, "zap"); },
  boom: () => noise(0.35, 0.25, 600, "boom"),
  frost: () => tone(1800, 0.15, "sine", 0.05, 0.5, 0, "frost"),
  beam: () => tone(220, 0.2, "sawtooth", 0.05, 1.5, 0, "beam"),
  die: () => noise(0.12, 0.08, 2500, "die"),
  leak: () => { tone(160, 0.25, "square", 0.15, 0.6); },
  place: () => { tone(300, 0.08, "square", 0.12); tone(600, 0.1, "square", 0.1, 1, 0.07); },
  up: () => [440, 660, 880].forEach((f, i) => tone(f, 0.1, "square", 0.1, 1, i * 0.06)),
  sell: () => tone(500, 0.15, "triangle", 0.15, 0.5),
  coin: () => { tone(988, 0.08, "square", 0.1); tone(1319, 0.15, "square", 0.1, 1, 0.07); },
  wave: () => [330, 440, 554].forEach((f, i) => tone(f, 0.18, "sawtooth", 0.1, 1, i * 0.1)),
  boss: () => { tone(110, 0.8, "sawtooth", 0.25, 0.5); noise(0.8, 0.2, 300); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "square", 0.12, 1, i * 0.12)),
  lose: () => [440, 330, 220, 110].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.12, 1, i * 0.15)),
  click: () => tone(700, 0.04, "square", 0.08),
  nope: () => tone(150, 0.15, "square", 0.12),
  crate: () => { for (let i = 0; i < 8; i++) tone(300 + i * 80, 0.08, "square", 0.06, 1, i * 0.09); },
  reveal: (r) => { const f = [523, 587, 659, 784, 988, 1175][r] || 523; [1, 1.25, 1.5, 2].forEach((k, i) => tone(f * k, 0.3, "square", 0.12, 1, i * 0.1)); if (r >= 4) noise(0.6, 0.15, 4000); },
  step: () => tone(90, 0.04, "sine", 0.05, 1, 0, "step"),
};
