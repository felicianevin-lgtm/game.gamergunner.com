// ZOMBIE SIEGE: every sound is made in code with WebAudio (no sound files).
// The audio context is only created after the player clicks or presses a key (browsers require that).
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem("gv_zombies_mute") === "1"; } catch {}

export function audio() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.75; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(comp);
    musicBus = ac.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem("gv_zombies_mute", m ? "1" : "0"); } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.75, ac.currentTime, 0.05);
}
const live = () => ac && ac.state === "running" && !muted;

function tone(f, len, type = "square", slide = 0, vol = 0.5, delay = 0, bus = sfxBus, attack = 0.004) {
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.2, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + len + 0.05);
  return o;
}
function noise(len, freq, vol = 0.5, type = "lowpass", delay = 0, slide = 0, q = 1, bus = sfxBus) {
  const t = ac.currentTime + delay, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  n.buffer = noiseBuf; n.playbackRate.value = 0.8 + Math.random() * 0.4;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + len);
  g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
}
// a cartoony zombie "uuuurgh": a buzzy voice through a moving vowel filter with wobble
function voice(f, len, vol, formant = 700, wob = 7) {
  const t = ac.currentTime, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), bp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.75, t + len);
  lfo.frequency.value = wob; lg.gain.value = f * 0.08; lfo.connect(lg); lg.connect(o.frequency);
  bp.type = "bandpass"; bp.Q.value = 4; bp.frequency.setValueAtTime(formant, t); bp.frequency.linearRampToValueAtTime(formant * 0.55, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.08); g.gain.setValueAtTime(vol * 0.35, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(bp); bp.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
}

// limit how often the same sound plays (an SMG + 60 pops in one frame would be noise)
const last = {};
const gate = (k, gap) => { const n = performance.now(); if (last[k] && n - last[k] < gap) return false; last[k] = n; return true; };

export const SFX = {
  blaster() { if (!live() || !gate("bl", 40)) return; tone(1300, 0.12, "square", 300, 0.35); tone(650, 0.08, "triangle", 200, 0.3); },
  shotgun() { if (!live()) return; noise(0.35, 1800, 1.0, "lowpass", 0, 200); tone(120, 0.25, "sine", 45, 1.2); noise(0.08, 4000, 0.5, "highpass"); },
  smg() { if (!live() || !gate("smg", 45)) return; noise(0.07, 2600, 0.55, "bandpass", 0, 900, 2); tone(420 + Math.random() * 60, 0.05, "square", 180, 0.25); },
  rail() { if (!live()) return; tone(300, 0.5, "sawtooth", 2400, 0.35); tone(2400, 0.35, "sine", 300, 0.5, 0.02); noise(0.25, 6000, 0.35, "highpass"); },
  rocket() { if (!live()) return; noise(0.5, 900, 0.8, "bandpass", 0, 300, 1.5); tone(200, 0.3, "triangle", 80, 0.5); },
  turret() { if (!live() || !gate("tur", 70)) return; tone(1700, 0.06, "square", 900, 0.18); },
  empty() { if (!live() || !gate("emp", 150)) return; tone(900, 0.03, "square", 0, 0.3); tone(600, 0.03, "square", 0, 0.25, 0.05); },
  reload() { if (!live()) return; tone(500, 0.05, "square", 300, 0.3); tone(300, 0.06, "square", 0, 0.3, 0.12); tone(800, 0.05, "square", 1200, 0.3, 0.3); },
  hit() { if (!live() || !gate("hit", 35)) return; tone(220 + Math.random() * 80, 0.06, "square", 120, 0.18); },
  pop() { if (!live() || !gate("pop", 30)) return; const f = 500 + Math.random() * 300; tone(f, 0.12, "sine", f * 3, 0.7); noise(0.12, 3000, 0.35, "bandpass", 0, 800, 1); },
  bigPop() { if (!live()) return; tone(200, 0.3, "sine", 900, 0.9); noise(0.4, 1500, 0.7, "lowpass", 0, 200); [784, 988, 1175].forEach((f, i) => tone(f, 0.15, "triangle", 0, 0.3, 0.08 + i * 0.06)); },
  boom() { if (!live() || !gate("boom", 60)) return; noise(0.9, 1200, 1.2, "lowpass", 0, 60); tone(90, 0.6, "sine", 30, 1.4); },
  splat() { if (!live()) return; noise(0.3, 700, 0.9, "lowpass", 0, 150); tone(160, 0.3, "sine", 60, 0.7); tone(600, 0.2, "triangle", 1500, 0.3, 0.05); },
  coin() { if (!live() || !gate("coin", 45)) return; tone(1320, 0.07, "square", 0, 0.22); tone(1760, 0.16, "square", 0, 0.22, 0.06); },
  heal() { if (!live()) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "triangle", 0, 0.45, i * 0.06)); },
  ammo() { if (!live()) return; tone(400, 0.06, "square", 0, 0.3); tone(600, 0.1, "square", 0, 0.3, 0.07); },
  hurt() { if (!live() || !gate("hurt", 120)) return; tone(220, 0.22, "square", 90, 0.6); noise(0.15, 900, 0.4); },
  dash() { if (!live()) return; noise(0.25, 1200, 0.6, "bandpass", 0, 4000, 1.2); },
  groan(kind) {
    if (!live() || !gate("groan", 500)) return;
    const k = { walker: [95, 0.9, 650], runner: [150, 0.5, 900], tank: [62, 1.2, 450], boomer: [120, 0.8, 800] }[kind] || [95, 0.9, 650];
    voice(k[0] * (0.9 + Math.random() * 0.25), k[1], 0.5, k[2], 5 + Math.random() * 5);
  },
  fuse() { if (!live() || !gate("fuse", 200)) return; [0, 0.15, 0.3, 0.42, 0.52].forEach((d) => tone(1400, 0.05, "square", 0, 0.25, d)); },
  roar() { if (!live()) return; voice(55, 1.6, 1.0, 420, 9); voice(82, 1.4, 0.7, 600, 11); noise(1.4, 600, 0.8, "lowpass", 0, 120); },
  slam() { if (!live()) return; tone(60, 0.8, "sine", 25, 1.6); noise(0.8, 500, 1.2, "lowpass", 0, 40); },
  horn() {
    if (!live()) return;
    [[233, 0], [311, 0], [233, 0.42], [349, 0.42]].forEach(([f, d]) => { tone(f, 0.38, "sawtooth", 0, 0.3, d, sfxBus, 0.03); tone(f * 1.005, 0.38, "square", 0, 0.12, d, sfxBus, 0.03); });
  },
  clear() { if (!live()) return; [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, "square", 0, 0.25, i * 0.09)); },
  buy() { if (!live()) return; tone(988, 0.08, "square", 0, 0.3); tone(1319, 0.25, "square", 0, 0.3, 0.08); noise(0.2, 6000, 0.2, "highpass", 0.08); },
  nope() { if (!live() || !gate("nope", 200)) return; tone(160, 0.18, "square", 120, 0.4); },
  build() { if (!live()) return; [0, 0.1, 0.2].forEach((d) => { noise(0.06, 1500, 0.6, "bandpass", d, 0, 2); tone(300, 0.05, "square", 200, 0.3, d); }); },
  combo(n) { if (!live() || !gate("combo", 80)) return; tone(600 + Math.min(n, 30) * 40, 0.08, "triangle", 0, 0.25); },
  click() { if (!live()) return; tone(700, 0.04, "square", 0, 0.2); },
  over() { if (!live()) return; [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, "triangle", f * 0.97, 0.5, i * 0.25)); },
};

// ---------------------------------------------------------------- background music: a spooky-but-bouncy loop
// level 0 = menu/shop (chill), 1 = a wave, 2 = a boss wave
let mLevel = 0, mTimer = null, mStep = 0, mNext = 0;
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const BASS = [40, 0, 52, 0, 43, 0, 55, 0, 45, 0, 57, 0, 46, 0, 47, 0, 40, 0, 52, 0, 43, 0, 55, 0, 50, 0, 48, 0, 47, 0, 43, 0];
const LEAD = [64, 67, 71, 67, 64, 67, 72, 71, 69, 0, 67, 0, 66, 67, 0, 0, 64, 67, 71, 74, 72, 71, 69, 67, 66, 0, 67, 0, 64, 0, 0, 0];
function schedule() {
  if (!ac || ac.state !== "running") return;
  const bpm = mLevel === 2 ? 150 : mLevel === 1 ? 132 : 112, s16 = 60 / bpm / 4;
  if (mNext < ac.currentTime) mNext = ac.currentTime + 0.05;
  while (mNext < ac.currentTime + 0.3) {
    const i = mStep % 32, d = mNext - ac.currentTime;
    if (BASS[i]) { tone(N(BASS[i]), s16 * 1.8, "triangle", 0, 0.9, d, musicBus, 0.005); tone(N(BASS[i]), s16 * 1.2, "square", 0, 0.12, d, musicBus, 0.005); }
    if (mLevel >= 1 && i % 8 === 0) tone(150, 0.18, "sine", 40, 1.3, d, musicBus, 0.002);
    if (i % 4 === 2) noise(0.04, 7000, mLevel ? 0.25 : 0.12, "highpass", d, 0, 1, musicBus);
    if (mLevel >= 1 && i % 8 === 4) noise(0.12, 2500, 0.35, "bandpass", d, 0, 1, musicBus);
    if (mLevel >= 1 && (mStep >> 5) % 2 === 1 && LEAD[i]) tone(N(LEAD[i] + (mLevel === 2 ? 0 : 0)), s16 * 1.6, mLevel === 2 ? "sawtooth" : "square", 0, 0.18, d, musicBus, 0.005);
    if (mLevel === 0 && i % 16 === 0) tone(N(LEAD[(mStep >> 4) % 32] || 64), s16 * 6, "sine", 0, 0.25, d, musicBus, 0.05);
    mNext += s16; mStep++;
  }
}
export function music(level) {
  mLevel = level;
  if (!mTimer) mTimer = setInterval(schedule, 90);
}
