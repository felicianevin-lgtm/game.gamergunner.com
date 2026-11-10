// CLASH sounds: all made on the spot (beeps, noise and sweeps), no sound files. vol is 0..1 (quieter when far away).
let ac = null, master = null;
function ctx() {
  if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function tone(freq, len, type, slide, vol, delay = 0) {
  try {
    const a = ctx(), t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + len);
    g.gain.setValueAtTime((vol ?? 1) * 0.12, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.02);
  } catch {}
}
function noise(len, freq, vol, type = "lowpass", slideTo, delay = 0) {
  try {
    const a = ctx(), t = a.currentTime + delay, n = a.createBufferSource(), buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    n.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + len);
    const g = a.createGain(); g.gain.value = (vol ?? 1) * 0.35;
    n.connect(f); f.connect(g); g.connect(master); n.start(t);
  } catch {}
}
export function unlockSound() { try { ctx(); } catch {} }
export function sfx(name, vol = 1) {
  if (vol < 0.03) return;
  switch (name) {
    case "swing": noise(0.12, 2500, 0.35 * vol, "bandpass", 900); break;
    case "hit": noise(0.12, 900, 0.8 * vol); tone(160, 0.1, "square", 70, 0.6 * vol); break;
    case "bighit": noise(0.35, 700, 1.1 * vol, "lowpass", 120); tone(110, 0.3, "sawtooth", 40, 0.8 * vol); break;
    case "block": tone(900, 0.06, "square", 600, 0.5 * vol); noise(0.06, 4000, 0.3 * vol, "highpass"); break;
    case "dash": noise(0.25, 1200, 0.5 * vol, "bandpass", 300); break;
    case "jump": tone(300, 0.15, "triangle", 600, 0.4 * vol); break;
    case "land": noise(0.12, 300, 0.4 * vol); break;
    case "orb": tone(220, 0.5, "sine", 880, 0.7 * vol); tone(330, 0.5, "triangle", 1200, 0.3 * vol); break;
    case "blast": tone(880, 0.35, "sawtooth", 110, 0.6 * vol); noise(0.4, 1800, 0.7 * vol, "lowpass", 200); break;
    case "charge": tone(110, 1.0, "sawtooth", 880, 0.45 * vol); tone(165, 1.0, "square", 1320, 0.2 * vol); break;
    case "beam": noise(1.4, 600, 1.2 * vol, "lowpass", 90); tone(70, 1.4, "sawtooth", 35, 0.9 * vol); tone(600, 0.6, "sine", 150, 0.5 * vol); break;
    case "slash": noise(0.1, 5000, 0.5 * vol, "highpass"); tone(1800, 0.08, "sawtooth", 500, 0.25 * vol); break;
    case "crescent": noise(0.4, 3000, 0.7 * vol, "bandpass", 500); tone(1200, 0.35, "sawtooth", 200, 0.3 * vol); break;
    case "fire": noise(0.9, 1500, 0.8 * vol, "lowpass", 300); tone(200, 0.6, "sawtooth", 60, 0.4 * vol); break;
    case "boom": noise(0.9, 500, 1.3 * vol, "lowpass", 60); tone(80, 0.7, "sine", 30, 1 * vol); break;
    case "spark": tone(2400, 0.12, "square", 200, 0.6 * vol); noise(0.2, 6000, 0.6 * vol, "highpass"); tone(90, 0.3, "sawtooth", 40, 0.7 * vol, 0.03); break;
    case "slam": noise(0.6, 250, 1.3 * vol, "lowpass", 50); tone(60, 0.5, "sine", 25, 1 * vol); break;
    case "howl": tone(400, 0.6, "sine", 800, 0.3 * vol); tone(800, 0.5, "sine", 500, 0.25 * vol, 0.4); break;
    case "shadow": tone(200, 0.4, "sine", 60, 0.5 * vol); noise(0.4, 800, 0.4 * vol, "lowpass", 100); break;
    case "serpent": noise(1.0, 400, 1.2 * vol, "lowpass", 80); tone(90, 0.9, "sawtooth", 45, 0.8 * vol); tone(300, 0.5, "square", 120, 0.3 * vol, 0.2); break;
    case "domain": [130, 196, 261, 392].forEach((f, i) => tone(f, 1.6, "sawtooth", f / 2, 0.35 * vol, i * 0.12)); noise(1.8, 400, 0.6 * vol, "lowpass", 80); break;
    case "ko": [523, 392, 262, 131].forEach((f, i) => tone(f, 0.25, "square", 0, 0.4 * vol, i * 0.12)); break;
    case "pick": tone(660, 0.08, "square", 0, 0.4); tone(990, 0.12, "square", 0, 0.4, 0.07); break;
    case "ready": tone(440, 0.1, "triangle", 880, 0.3 * vol); break;
    default: tone(660, 0.1, "square", 0, 0.3 * vol);
  }
}
