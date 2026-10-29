// Game Mode's sound effects, synthesized with Web Audio: no audio files to download. Loaded
// only when the player turns sound on (it is off by default).

export const createSfx = () => {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.15;
  master.connect(ctx.destination);
  // One second of white noise, made once, for the crack and the hiss
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  noise.getChannelData(0).forEach((_, i, data) => {
    data[i] = Math.random() * 2 - 1;
  });

  // A context made outside a click (back from a demo) starts suspended
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx.currentTime;
  };
  const envelope = (volume, length, now) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    gain.connect(master);
    return gain;
  };

  // A short tone sliding from one pitch to another while it fades out
  const tone = (type, from, to, length, volume, delay = 0) => {
    const now = wake() + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + length);
    osc.connect(envelope(volume, length, now));
    osc.start(now);
    osc.stop(now + length);
  };
  // Filtered noise: a high band for a crack, a sweeping band for a hiss
  const burst = (length, volume, from, to) => {
    const now = wake();
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(to, now + length);
    source.connect(filter).connect(envelope(volume, length, now));
    source.start(now);
    source.stop(now + length);
  };

  return {
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    close: () => ctx.close(),
    step: () => tone('triangle', 120, 60, 0.07, 0.7),
    blip: () => tone('square', 660, 990, 0.09, 0.35),
    // Kar98k: a sharp crack with a falling whine
    sniper: () => {
      burst(0.12, 0.9, 4000, 1500);
      tone('sawtooth', 1800, 200, 0.25, 0.25);
    },
    // Terraform Tactical: a quick two-step "provisioning" blip
    provision: () => {
      tone('square', 520, 780, 0.05, 0.25);
      tone('square', 780, 1040, 0.05, 0.25, 0.05);
    },
    // The DevOps Defender: a heavy bass thud
    thud: () => tone('sine', 110, 32, 0.35, 1),
    // A door sliding open
    hiss: () => burst(0.45, 0.6, 2500, 400),
    // A line of dialogue starting
    talk: () => tone('triangle', 440, 660, 0.08, 0.3),
  };
};
