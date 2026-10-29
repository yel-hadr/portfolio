// Game Mode's sound effects, synthesized with Web Audio: no audio files to download. Loaded
// only when the player turns sound on (it is off by default).

export const createSfx = () => {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.15;
  master.connect(ctx.destination);

  // A short tone sliding from one pitch to another while it fades out
  const tone = (type, from, to, length, volume) => {
    // A context made outside a click (back from a demo) starts suspended
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + length);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + length);
  };

  return {
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    close: () => ctx.close(),
    step: () => tone('triangle', 120, 60, 0.07, 0.7),
    blip: () => tone('square', 660, 990, 0.09, 0.35),
    zap: () => tone('sawtooth', 880, 110, 0.16, 0.3),
  };
};
