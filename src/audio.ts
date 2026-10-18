// Tiny Web Audio synth. All sounds are generated, no files.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function env(c: AudioContext, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(c.destination);
  return g;
}

function noise(seconds: number, freq: number, q: number, peak: number, type: BiquadFilterType = 'bandpass') {
  const c = ac(); if (!c) return;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, seconds);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  src.connect(f).connect(env(c, peak, 0.002, seconds));
  src.start();
}

function tone(type: OscillatorType, from: number, to: number, seconds: number, peak: number) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(from, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), c.currentTime + seconds);
  o.connect(env(c, peak, 0.005, seconds));
  o.start(); o.stop(c.currentTime + seconds + 0.05);
}

export const sfx = {
  nail: () => { noise(0.08, 2400, 1.2, 0.35); tone('square', 180, 60, 0.06, 0.15); },
  swing: () => noise(0.18, 900, 0.7, 0.18),
  thunk: () => { tone('triangle', 140, 50, 0.12, 0.4); noise(0.06, 600, 2, 0.2); },
  empty: () => tone('square', 900, 850, 0.03, 0.08),
  reload: () => { noise(0.05, 3000, 4, 0.15); setTimeout(() => noise(0.07, 1800, 4, 0.18), 650); },
  hurt: () => tone('sawtooth', 220, 90, 0.25, 0.25),
  drifterAlert: () => tone('sine', 300, 900, 0.35, 0.18),
  drifterWindup: () => tone('sawtooth', 120, 480, 0.4, 0.12),
  drifterDie: () => { tone('sine', 700, 60, 0.6, 0.25); noise(0.4, 500, 0.5, 0.15); },
  rumble: () => { noise(1.8, 70, 0.6, 0.6, 'lowpass'); tone('sine', 55, 30, 1.6, 0.35); },
  crash: () => { noise(0.9, 300, 0.4, 0.55, 'lowpass'); noise(0.5, 2500, 1, 0.2); tone('triangle', 90, 30, 0.8, 0.35); },
  clunk: () => { tone('square', 110, 70, 0.12, 0.3); noise(0.05, 1200, 3, 0.2); },
  zap: () => tone('sawtooth', 1400, 300, 0.25, 0.12),
  pickup: () => { tone('square', 660, 660, 0.06, 0.1); setTimeout(() => tone('square', 990, 990, 0.08, 0.1), 70); },
};
