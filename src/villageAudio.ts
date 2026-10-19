// Village slice audio, all synthesized: wind bed, barn door creak, distant dog, footsteps (dirt / wood / straw /
// stone), examine chime, end drone. Every voice is a builder (ctx, out, t) so it plays live and also renders in an
// OfflineAudioContext for peak checks (measureVillagePeaks). Mix: master gain 0.8 into a limiter (-3 dB, 20:1).
type Ctx = BaseAudioContext;
export type Step = 'dirt' | 'wood' | 'straw' | 'stone';
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function brown(c: Ctx, seconds: number): AudioBuffer {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate), d = b.getChannelData(0);
  let last = 0, peak = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last; }
  // Loop seam: crossfade the tail into the head so the bed never clicks.
  const fade = Math.floor(c.sampleRate * 0.25);
  for (let i = 0; i < fade; i++) { const t = i / fade; d[d.length - fade + i] = d[d.length - fade + i] * (1 - t) + d[i] * t; }
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < d.length; i++) d[i] /= peak || 1;
  return b;
}
function white(c: Ctx, seconds: number): AudioBuffer {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function envAt(c: Ctx, out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}
function burst(c: Ctx, out: AudioNode, t: number, seconds: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack = 0.003) {
  const s = c.createBufferSource(); s.buffer = white(c, seconds + 0.05);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  s.connect(f).connect(envAt(c, out, t, peak, attack, seconds));
  s.start(t); s.stop(t + attack + seconds + 0.05);
}
function reverbIR(c: Ctx, seconds: number): AudioBuffer {
  const b = c.createBuffer(2, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * 0.5;
  }
  return b;
}

export const voices = {
  step(c: Ctx, out: AudioNode, t: number, s: Step, k = 1) {
    if (s === 'wood') {
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(rand(105, 130), t); o.frequency.exponentialRampToValueAtTime(58, t + 0.11);
      o.connect(envAt(c, out, t, 0.32 * k, 0.003, 0.12)); o.start(t); o.stop(t + 0.18);
      burst(c, out, t, 0.05, 'bandpass', rand(1600, 2200), 2.5, 0.14 * k);
      burst(c, out, t + 0.004, 0.11, 'bandpass', rand(380, 460), 5, 0.3 * k);
    } else if (s === 'straw') {
      for (let i = 0; i < 3; i++) burst(c, out, t + i * rand(0.025, 0.05), rand(0.06, 0.12), 'bandpass', rand(2600, 4200), 0.9, 0.16 * k);
      burst(c, out, t, 0.08, 'lowpass', 420, 0.7, 0.3 * k);
    } else if (s === 'stone') {
      burst(c, out, t, 0.035, 'bandpass', rand(1100, 1500), 3, 0.8 * k);
      burst(c, out, t, 0.07, 'lowpass', 300, 0.7, 0.9 * k);
    } else {
      burst(c, out, t, rand(0.08, 0.12), 'lowpass', rand(520, 760), 0.8, 0.75 * k);
      burst(c, out, t + 0.01, 0.06, 'bandpass', rand(2200, 3200), 1.2, 0.14 * k);
    }
  },
  chime(c: Ctx, out: AudioNode, t: number) {
    for (const [f, p, d] of [[1046.5, 0.07, 1.6], [1568, 0.045, 1.2], [2889, 0.012, 0.6]] as const) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.connect(envAt(c, out, t, p, 0.012, d)); o.start(t); o.stop(t + d + 0.1);
    }
  },
  /** Stick-slip creak: a gliding pulse train ringing two resonators (the wood body of the door). */
  creak(c: Ctx, out: AudioNode, t: number, k = 1) {
    const dur = rand(0.7, 1.2);
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(28, 36), t);
    o.frequency.linearRampToValueAtTime(rand(18, 24), t + dur * 0.45);
    o.frequency.linearRampToValueAtTime(rand(40, 55), t + dur);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * k, t + 0.12);
    g.gain.setValueAtTime(0.5 * k, t + dur - 0.2); g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(out);
    o.connect(hp);
    for (const [f, q] of [[rand(560, 700), 9], [rand(1300, 1600), 7]]) {
      const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      hp.connect(b).connect(g);
    }
    o.start(t); o.stop(t + dur + 0.05);
  },
  /** One distant dog: 2-3 barks through formants, lowpassed and sent to a long reverb. */
  dog(c: Ctx, out: AudioNode, t: number, pan: number) {
    const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
    const dry = c.createGain(); dry.gain.value = 0.5;
    const rv = c.createConvolver(); rv.buffer = reverbIR(c, 2.4);
    const wet = c.createGain(); wet.gain.value = 0.45;
    lp.connect(dry).connect(p); lp.connect(rv).connect(wet).connect(p); p.connect(out);
    const n = Math.random() < 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const s = t + i * rand(0.32, 0.45);
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(rand(430, 520), s); o.frequency.exponentialRampToValueAtTime(rand(260, 320), s + 0.14);
      const g = envAt(c, lp, s, 0.2, 0.008, 0.16);
      for (const [f, q] of [[950, 3], [2100, 4]]) {
        const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
        o.connect(b).connect(g);
      }
      o.start(s); o.stop(s + 0.22);
    }
  },
  /** Gate or door latch: a bright iron click, then the knock of the wood against its post. */
  latch(c: Ctx, out: AudioNode, t: number, k = 1) {
    burst(c, out, t, 0.025, 'bandpass', rand(2800, 3600), 6, 0.35 * k);
    burst(c, out, t + 0.012, 0.04, 'bandpass', rand(5200, 6400), 8, 0.12 * k);
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(rand(150, 190), t + 0.03); o.frequency.exponentialRampToValueAtTime(70, t + 0.13);
    o.connect(envAt(c, out, t + 0.03, 0.22 * k, 0.003, 0.1)); o.start(t + 0.03); o.stop(t + 0.2);
  },
  /** A locked door: the latch tried three times against the bolt. */
  rattle(c: Ctx, out: AudioNode, t: number) {
    for (let i = 0; i < 3; i++) {
      const s = t + i * rand(0.09, 0.12);
      burst(c, out, s, 0.03, 'bandpass', rand(2300, 3000), 5, 0.3);
      burst(c, out, s + 0.01, 0.06, 'lowpass', 380, 0.8, 0.35);
    }
  },
  /** The church bell [3], 22 m up the tower: inharmonic bell partials (hum, prime, minor third, fifth, nominal and up),
   *  the low ones ringing longest, through a long hall reverb. Two strokes as the bell swings. */
  bell(c: Ctx, out: AudioNode, t: number, k = 1) {
    const rv = c.createConvolver(); rv.buffer = reverbIR(c, 4.5);
    const wet = c.createGain(); wet.gain.value = 0.55; const dry = c.createGain(); dry.gain.value = 0.7;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    lp.connect(dry).connect(out); lp.connect(rv).connect(wet).connect(out);
    const f0 = 311;
    for (const [s, gap] of [[0, 0], [1, 1.9]] as const) {
      const ts = t + gap, a = s ? 0.75 : 1;
      for (const [r, p, d] of [[0.5, 0.05, 7], [1, 0.07, 5], [1.19, 0.06, 3.2], [1.5, 0.03, 2.4], [2, 0.05, 3], [2.51, 0.025, 1.6], [2.66, 0.02, 1.4], [3.01, 0.015, 1.1], [4.1, 0.01, 0.6]] as const) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f0 * r * (1 + (Math.random() - 0.5) * 0.002);
        o.connect(envAt(c, lp, ts, p * a * k, 0.004, d)); o.start(ts); o.stop(ts + d + 0.1);
      }
      burst(c, lp, ts, 0.03, 'bandpass', 2400, 2, 0.12 * a * k);   // the clapper
    }
  },
  /** A prop dragged over boards: rough noise through a wood (or tin) body, one grain per call. */
  scrape(c: Ctx, out: AudioNode, t: number, k = 1, metal = false) {
    burst(c, out, t, rand(0.08, 0.13), 'bandpass', metal ? rand(1800, 2600) : rand(520, 760), metal ? 4 : 1.6, 0.22 * k, 0.02);
    if (metal) burst(c, out, t + 0.02, 0.06, 'bandpass', rand(4200, 5200), 8, 0.06 * k);
  },
  /** A prop knocked against a wall, a post or another prop. */
  bump(c: Ctx, out: AudioNode, t: number, k = 1, metal = false) {
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(metal ? rand(420, 520) : rand(140, 180), t); o.frequency.exponentialRampToValueAtTime(metal ? 300 : 70, t + 0.12);
    o.connect(envAt(c, out, t, 0.25 * k, 0.002, metal ? 0.35 : 0.12)); o.start(t); o.stop(t + 0.45);
    burst(c, out, t, 0.05, 'lowpass', 500, 0.8, 0.3 * k);
  },
  /** The camcorder: a soft relay click and one beep when recording starts, two short beeps when it stops. */
  rec(c: Ctx, out: AudioNode, t: number, on: boolean) {
    burst(c, out, t, 0.02, 'bandpass', 3200, 3, 0.1);
    for (let i = 0; i < (on ? 1 : 2); i++) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = on ? 2093 : 1568;
      const ts = t + 0.03 + i * 0.11;
      o.connect(envAt(c, out, ts, 0.05, 0.004, on ? 0.12 : 0.06)); o.start(ts); o.stop(ts + 0.2);
    }
  },
  /** Low swell under the title card. */
  drone(c: Ctx, out: AudioNode, t: number) {
    for (const [f, p] of [[55, 0.09], [82.4, 0.05], [110.3, 0.025]] as const) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p, t + 3); g.gain.setValueAtTime(p, t + 6); g.gain.linearRampToValueAtTime(0, t + 10);
      o.connect(g).connect(out); o.start(t); o.stop(t + 10.1);
    }
  },
};

/** Wind bed: looping brown noise through a body lowpass, a moving band, and a narrow whistle (wind in the boards). */
function windBed(c: Ctx, out: AudioNode) {
  const src = c.createBufferSource(); src.buffer = brown(c, 6); src.loop = true;
  const body = c.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 700; body.Q.value = 0.5;
  const band = c.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 420; band.Q.value = 0.8;
  const whistle = c.createBiquadFilter(); whistle.type = 'bandpass'; whistle.frequency.value = 1700; whistle.Q.value = 9;
  const gBody = c.createGain(); gBody.gain.value = 0;
  const gBand = c.createGain(); gBand.gain.value = 0;
  const gWhistle = c.createGain(); gWhistle.gain.value = 0;
  src.connect(body).connect(gBody).connect(out);
  src.connect(band).connect(gBand).connect(out);
  src.connect(whistle).connect(gWhistle).connect(out);
  src.start();
  return { body, band, whistle, gBody, gBand, gWhistle };
}
const WIND = { body: 0.3, band: 0.22, whistle: 0.5 };
function windAt(w: ReturnType<typeof windBed>, gust: number, indoor: number, fade: number, t: number | null) {
  const k = fade * (0.55 + 0.45 * gust);
  const set = (p: AudioParam, v: number, tc: number) => { if (t === null) p.value = v; else p.setTargetAtTime(v, t, tc); };
  set(w.gBody.gain, WIND.body * k * (1 - 0.45 * indoor), 0.25);
  set(w.gBand.gain, WIND.band * k * (1 - 0.6 * indoor), 0.25);
  set(w.gWhistle.gain, WIND.whistle * fade * gust * gust * (0.3 + 0.7 * indoor), 0.3);
  set(w.body.frequency, 380 + 520 * gust - 200 * indoor, 0.3);
  set(w.band.frequency, 300 + 380 * gust, 0.4);
  set(w.whistle.frequency, 1500 + 500 * gust, 0.5);
}

/** The stream over its stones: two bands of looping noise, one babbling (slow random gain), one hiss. */
function streamBed(c: Ctx, out: AudioNode) {
  const src = c.createBufferSource(); src.buffer = white(c, 4); src.loop = true;
  const bab = c.createBiquadFilter(); bab.type = 'bandpass'; bab.frequency.value = 900; bab.Q.value = 1.4;
  const hiss = c.createBiquadFilter(); hiss.type = 'highpass'; hiss.frequency.value = 2600;
  const gBab = c.createGain(), gHiss = c.createGain(), lfo = c.createOscillator(), lfoG = c.createGain();
  gBab.gain.value = 0; gHiss.gain.value = 0; lfo.frequency.value = 3.1; lfoG.gain.value = 260;
  lfo.connect(lfoG).connect(bab.frequency);
  src.connect(bab).connect(gBab).connect(out);
  src.connect(hiss).connect(gHiss).connect(out);
  src.start(); lfo.start();
  return { gBab, gHiss };
}
function streamAt(s: ReturnType<typeof streamBed>, level: number, t: number | null) {
  const set = (p: AudioParam, v: number) => { if (t === null) p.value = v; else p.setTargetAtTime(v, t, 0.4); };
  set(s.gBab.gain, 0.16 * level); set(s.gHiss.gain, 0.05 * level);
}

function masterChain(c: Ctx) {
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  const master = c.createGain(); master.gain.value = 0.8;
  master.connect(lim).connect(c.destination);
  return master;
}

/** Live village ambience. start() must run inside a user gesture (browsers block audio before one). */
export function villageAudio() {
  let c: AudioContext | null = null, master: GainNode | null = null, wind: ReturnType<typeof windBed> | null = null, lastWind = 0;
  let stream: ReturnType<typeof streamBed> | null = null, lastStream = 0;
  return {
    start() {
      if (c) { if (c.state === 'suspended') void c.resume(); return; }
      try { c = new AudioContext(); } catch { return; }
      master = masterChain(c);
      wind = windBed(c, master);
      stream = streamBed(c, master);
    },
    /** Stream loudness 0..1 (by the listener's distance to the water). */
    stream(level: number) {
      if (!c || !stream || c.state !== 'running' || c.currentTime - lastStream < 0.1) return;
      lastStream = c.currentTime;
      streamAt(stream, level, c.currentTime);
    },
    /** gust 0..1; indoor 0..1 muffles the body and brings up the whistle through the boards; fade 0..1 for the end. */
    wind(gust: number, indoor: number, fade = 1) {
      // 10 Hz is plenty under 0.25 s time constants; never queue automation on a suspended context.
      if (!c || !wind || c.state !== 'running' || c.currentTime - lastWind < 0.1) return;
      lastWind = c.currentTime;
      windAt(wind, gust, indoor, fade, c.currentTime);
    },
    /** arg: the surface for 'step', the pan for 'dog', 1 for a metal prop ('scrape', 'bump'), the delay (s) for 'bell',
     *  1 = start / 0 = stop for 'rec'. */
    play(name: 'step' | 'chime' | 'creak' | 'dog' | 'drone' | 'latch' | 'rattle' | 'bell' | 'scrape' | 'bump' | 'rec', arg?: Step | number, k = 1) {
      if (!c || !master) return;
      const t = c.currentTime + 0.005;
      if (name === 'bell') { voices.bell(c, master, t + ((arg as number | undefined) ?? 0), k); return; }
      if (name === 'scrape' || name === 'bump') { voices[name](c, master, t, k, arg === 1); return; }
      if (name === 'rec') { voices.rec(c, master, t, arg === 1); return; }
      if (name === 'step') voices.step(c, master, t, (arg as Step | undefined) ?? 'dirt', k);
      else if (name === 'creak') voices.creak(c, master, t, k);
      else if (name === 'latch') voices.latch(c, master, t, k);
      else if (name === 'rattle') voices.rattle(c, master, t);
      else if (name === 'dog') voices.dog(c, master, t, (arg as number | undefined) ?? 0);
      else if (name === 'chime') voices.chime(c, master, t);
      else voices.drone(c, master, t);
    },
  };
}

/** Renders each voice offline through the same master chain at its loudest in-game level; returns sample peaks. */
export async function measureVillagePeaks(): Promise<Record<string, number>> {
  const sr = 44100, out: Record<string, number> = {};
  const render = async (seconds: number, build: (c: OfflineAudioContext, m: GainNode) => void) => {
    const c = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
    build(c, masterChain(c));
    const buf = await c.startRendering();
    let p = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) for (const v of buf.getChannelData(ch)) p = Math.max(p, Math.abs(v));
    return Math.round(p * 1000) / 1000;
  };
  for (const s of ['dirt', 'wood', 'straw', 'stone'] as const) out[`step-${s}`] = await render(0.5, (c, m) => voices.step(c, m, 0.01, s, 1.2));
  out.chime = await render(2, (c, m) => voices.chime(c, m, 0.01));
  out.creak = await render(1.5, (c, m) => voices.creak(c, m, 0.01, 1));
  out.dog = await render(4, (c, m) => voices.dog(c, m, 0.01, 0));
  out.drone = await render(10.5, (c, m) => voices.drone(c, m, 0.01));
  out.wind = await render(8, (c, m) => windAt(windBed(c, m), 1, 1, 1, null));
  out.latch = await render(0.6, (c, m) => voices.latch(c, m, 0.01, 1));
  out.rattle = await render(0.8, (c, m) => voices.rattle(c, m, 0.01));
  out.bell = await render(9, (c, m) => voices.bell(c, m, 0.01, 1));
  out.scrape = await render(0.4, (c, m) => voices.scrape(c, m, 0.01, 1.5, true));
  out.bump = await render(0.6, (c, m) => voices.bump(c, m, 0.01, 1.5, true));
  out.rec = await render(0.5, (c, m) => voices.rec(c, m, 0.01, false));
  out.stream = await render(4, (c, m) => streamAt(streamBed(c, m), 1, null));
  // Worst case: full-gust wind + the stream at the stones + creak + chime + latch + a heavy step + a bark at once.
  out.allAtOnce = await render(3, (c, m) => {
    windAt(windBed(c, m), 1, 0, 1, null); streamAt(streamBed(c, m), 1, null);
    voices.creak(c, m, 0.5, 1); voices.chime(c, m, 0.5); voices.step(c, m, 0.5, 'wood', 1.2); voices.dog(c, m, 0.5, 0); voices.latch(c, m, 0.5, 1);
  });
  return out;
}
