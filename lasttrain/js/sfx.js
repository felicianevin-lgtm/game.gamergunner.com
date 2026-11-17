// LAST TRAIN WEST: every sound is made in code with WebAudio (no sound files).
let ac = null, master = null, bus = null, musicBus = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem("gv_train_mute") === "1"; } catch {}
export function audio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(master);
    bus = ac.createGain(); bus.connect(comp);
    musicBus = ac.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
export const isMuted = () => muted;
export function setMuted(m) { muted = m; try { localStorage.setItem("gv_train_mute", m ? "1" : "0"); } catch {} if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ac.currentTime, 0.05); }
const live = () => ac && ac.state === "running" && !muted;
function tone(f, len, type = "square", slide = 0, vol = 0.5, delay = 0, b = bus, attack = 0.004) {
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.2, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(b); o.start(t); o.stop(t + len + 0.05);
}
function noise(len, freq, vol = 0.5, type = "lowpass", delay = 0, slide = 0, q = 1, b = bus) {
  const t = ac.currentTime + delay, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  n.buffer = noiseBuf; n.playbackRate.value = 0.8 + Math.random() * 0.4; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + len);
  g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(f); f.connect(g); g.connect(b); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
}
function voice(f, len, vol, formant = 700, wob = 7) {
  const t = ac.currentTime, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), bp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.75, t + len);
  lfo.frequency.value = wob; lg.gain.value = f * 0.08; lfo.connect(lg); lg.connect(o.frequency);
  bp.type = "bandpass"; bp.Q.value = 4; bp.frequency.setValueAtTime(formant, t); bp.frequency.linearRampToValueAtTime(formant * 0.55, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(bp); bp.connect(g); g.connect(bus); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
}
const last = {};
const gate = (k, gap) => { const n = performance.now(); if (last[k] && n - last[k] < gap) return false; last[k] = n; return true; };
export const SFX = {
  revolver() { if (!live()) return; noise(0.25, 2200, 1.0, "lowpass", 0, 300); tone(160, 0.15, "sine", 60, 0.9); },
  shotgun() { if (!live()) return; noise(0.45, 1600, 1.2, "lowpass", 0, 150); tone(110, 0.3, "sine", 40, 1.3); },
  rifle() { if (!live()) return; noise(0.35, 3200, 1.1, "lowpass", 0, 400); tone(200, 0.12, "square", 70, 0.6); noise(0.6, 500, 0.3, "lowpass", 0.1); },
  gatling() { if (!live() || !gate("gat", 50)) return; noise(0.08, 2600, 0.7, "bandpass", 0, 900, 2); tone(140, 0.06, "square", 70, 0.3); },
  swing() { if (!live()) return; noise(0.18, 1200, 0.5, "bandpass", 0, 3500, 1.5); },
  thunk() { if (!live() || !gate("thk", 40)) return; tone(120, 0.12, "square", 60, 0.6); noise(0.1, 700, 0.6); },
  empty() { if (!live() || !gate("emp", 150)) return; tone(900, 0.03, "square", 0, 0.3); },
  reload() { if (!live()) return; [0, 0.15, 0.3].forEach((d) => tone(600, 0.04, "square", 300, 0.3, d)); tone(900, 0.06, "square", 1300, 0.3, 0.5); },
  hit() { if (!live() || !gate("hit", 35)) return; tone(240 + Math.random() * 60, 0.06, "square", 120, 0.2); noise(0.08, 900, 0.3); },
  coin() { if (!live() || !gate("coin", 45)) return; tone(1320, 0.07, "square", 0, 0.22); tone(1760, 0.16, "square", 0, 0.22, 0.06); },
  cash() { if (!live()) return; [988, 1319, 1568, 1976].forEach((f, i) => tone(f, 0.12, "square", 0, 0.22, i * 0.05)); noise(0.25, 6000, 0.25, "highpass"); },
  heal() { if (!live()) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "triangle", 0, 0.45, i * 0.06)); },
  pick() { if (!live()) return; tone(400, 0.06, "square", 0, 0.25); tone(600, 0.08, "square", 0, 0.25, 0.06); },
  drop() { if (!live()) return; tone(200, 0.1, "sine", 90, 0.6); noise(0.1, 600, 0.3); },
  furnace() { if (!live()) return; noise(0.9, 400, 0.9, "lowpass", 0, 1600); tone(80, 0.6, "sine", 50, 0.6); },
  hurt() { if (!live() || !gate("hurt", 140)) return; tone(220, 0.22, "square", 90, 0.6); noise(0.15, 900, 0.4); },
  groan(k) { if (!live() || !gate("groan", 600)) return; const p = { walker: [90, 0.9, 600], runner: [150, 0.5, 900], brute: [60, 1.2, 420], soldier: [100, 0.8, 700], vamp: [300, 0.6, 1600], bat: [900, 0.15, 3000], lord: [70, 1.4, 500] }[k] || [90, 0.9, 600]; voice(p[0] * (0.9 + Math.random() * 0.2), p[1], 0.5, p[2], 6); },
  hiss() { if (!live() || !gate("hiss", 400)) return; noise(0.6, 5000, 0.8, "highpass", 0, 2500); },
  boom() { if (!live()) return; noise(1.2, 1100, 1.4, "lowpass", 0, 50); tone(70, 0.8, "sine", 25, 1.6); },
  whistle() { if (!live()) return; [587, 740, 880].forEach((f) => { tone(f, 1.1, "sawtooth", f * 0.97, 0.18, 0, bus, 0.08); tone(f * 1.01, 1.1, "sine", 0, 0.3, 0, bus, 0.08); }); noise(1.1, 3000, 0.25, "bandpass", 0, 0, 3); },
  chuff(sp) { if (!live() || !gate("chuff", 60)) return; noise(0.16, 500 + sp * 30, 0.35 + Math.min(0.3, sp * 0.02), "bandpass", 0, 200, 1.5); },
  lever() { if (!live()) return; tone(300, 0.06, "square", 200, 0.4); tone(180, 0.1, "square", 0, 0.4, 0.07); },
  buy() { if (!live()) return; tone(988, 0.08, "square", 0, 0.3); tone(1319, 0.25, "square", 0, 0.3, 0.08); },
  nope() { if (!live() || !gate("nope", 200)) return; tone(160, 0.18, "square", 120, 0.4); },
  bell() { if (!live()) return; [0, 0.5].forEach((d) => { tone(660, 1.2, "sine", 0, 0.5, d); tone(1650, 0.8, "sine", 0, 0.15, d); }); },
  night(blood) { if (!live()) return; (blood ? [220, 208, 196, 185] : [330, 294, 262]).forEach((f, i) => tone(f, 0.7, "sawtooth", f * 0.98, 0.25, i * 0.35)); if (blood) voice(60, 2, 0.8, 400, 4); },
  win() { if (!live()) return; [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, "square", 0, 0.25, i * 0.1)); },
  over() { if (!live()) return; [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, "triangle", f * 0.97, 0.5, i * 0.25)); },
  click() { if (!live()) return; tone(700, 0.04, "square", 0, 0.2); },
};
// music: a slow lonesome western loop; level 0 = day, 1 = night, 2 = blood moon
let mLevel = -1, mTimer = null, mStep = 0, mNext = 0;
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const BASS = [45, 0, 52, 0, 45, 0, 52, 0, 43, 0, 50, 0, 40, 0, 47, 0];
const LEAD = [69, 0, 72, 74, 76, 0, 74, 72, 71, 0, 67, 0, 69, 0, 0, 0, 76, 0, 79, 76, 74, 0, 72, 71, 69, 0, 71, 72, 69, 0, 0, 0];
function schedule() {
  if (!ac || ac.state !== "running" || mLevel < 0) return;
  const bpm = mLevel === 2 ? 128 : mLevel === 1 ? 104 : 92, s8 = 60 / bpm / 2;
  if (mNext < ac.currentTime) mNext = ac.currentTime + 0.05;
  while (mNext < ac.currentTime + 0.4) {
    const i = mStep % 16, d = mNext - ac.currentTime, sh = mLevel === 2 ? -1 : 0;
    if (BASS[i]) tone(N(BASS[i] + sh), s8 * 1.8, "triangle", 0, 0.9, d, musicBus, 0.005);
    if (i % 2 === 1) noise(0.05, mLevel ? 5000 : 7000, 0.12, "highpass", d, 0, 1, musicBus);
    const l = LEAD[mStep % 32]; if (l && (mStep >> 5) % 2 === 0) tone(N(l + sh), s8 * 1.7, mLevel === 2 ? "sawtooth" : "triangle", 0, 0.22, d, musicBus, 0.01);
    if (mLevel >= 1 && i % 4 === 0) tone(110, 0.2, "sine", 40, 0.9, d, musicBus, 0.002);
    mNext += s8; mStep++;
  }
}
export function music(level) { mLevel = level; if (!mTimer) mTimer = setInterval(schedule, 100); }
