// Game Mode's sound, synthesized with Web Audio: no audio files to download. Loaded only when
// the player turns sound on (it is off by default). Everything runs through one master gain (the
// volume slider) and a gentle compressor, so the bass-heavy shots do not clip.

export const createSfx = (volume = 0.7) => {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = volume * 0.3;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 6;
  master.connect(limiter).connect(ctx.destination);
  // One second of white noise, made once, for cracks, hisses, steps and the hum
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  noise.getChannelData(0).forEach((_, i, data) => {
    data[i] = Math.random() * 2 - 1;
  });

  // A context made outside a click (back from a demo) starts suspended
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx.currentTime;
  };
  const envelope = (volumeAt, length, now, out = master) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volumeAt, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    gain.connect(out);
    return gain;
  };

  // A short tone sliding from one pitch to another while it fades out
  const tone = (type, from, to, length, level, delay = 0) => {
    const now = wake() + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + length);
    osc.connect(envelope(level, length, now));
    osc.start(now);
    osc.stop(now + length);
  };
  // Filtered noise: `type` a band (cracks, hisses) or a lowpass (muffled thumps)
  const burst = (length, level, from, to, type = 'bandpass', delay = 0) => {
    const now = wake() + delay;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(to, now + length);
    source.connect(filter).connect(envelope(level, length, now));
    source.start(now);
    source.stop(now + length);
  };

  // The server hum: two low tones and a breath of filtered noise, looping until turned off.
  // Ducked to 30% while the game is held (a menu, a dossier, a dialog)
  const HUM = 0.22;
  let hum = null;
  let ducked = false;
  const startHum = () => {
    if (hum) return;
    const now = wake();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(ducked ? HUM * 0.3 : HUM, now + 1.5);
    gain.connect(master);
    const parts = [55, 110.5].map((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i ? 'triangle' : 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i ? 0.25 : 0.6;
      osc.connect(g).connect(gain);
      osc.start(now);
      return osc;
    });
    const air = ctx.createBufferSource();
    air.buffer = noise;
    air.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 320;
    const ag = ctx.createGain();
    ag.gain.value = 0.35;
    air.connect(lowpass).connect(ag).connect(gain);
    air.start(now);
    hum = { gain, sources: [...parts, air] };
  };
  const stopHum = () => {
    if (!hum) return;
    const { gain, sources } = hum;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    sources.forEach((s) => s.stop(now + 0.45));
    hum = null;
  };

  return {
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    close: () => ctx.close(),
    setVolume: (value) => {
      master.gain.setTargetAtTime(value * 0.3, ctx.currentTime, 0.05);
    },
    hum: (on) => (on ? startHum() : stopHum()),
    duck: (on) => {
      ducked = on;
      if (!hum) return;
      const now = ctx.currentTime;
      // Held where it is: a duck during the fade-in would otherwise drop it to its start (silent)
      hum.gain.gain.cancelScheduledValues(now);
      hum.gain.gain.setValueAtTime(hum.gain.gain.value, now);
      hum.gain.gain.setTargetAtTime(on ? HUM * 0.3 : HUM, now, 0.15);
    },
    // A heavy, muffled boot on metal grating
    step: () => {
      burst(0.12, 0.9, 380, 90, 'lowpass');
      tone('sine', 85, 45, 0.11, 0.8);
    },
    blip: () => tone('square', 660, 990, 0.09, 0.35),
    // Kar98k: a sharp crack over a deep boom, with a falling whine
    sniper: () => {
      burst(0.12, 0.9, 4000, 1500);
      tone('sine', 90, 30, 0.45, 1.1);
      tone('sawtooth', 1800, 200, 0.25, 0.2);
    },
    // Terraform Tactical: a quick two-step "provisioning" blip with a punch under it
    provision: () => {
      tone('square', 520, 780, 0.05, 0.22);
      tone('square', 780, 1040, 0.05, 0.22, 0.05);
      tone('sine', 120, 50, 0.09, 0.7);
    },
    // The DevOps Defender: a heavy bass thud and a rush of air
    thud: () => {
      tone('sine', 110, 28, 0.5, 1.2);
      burst(0.3, 0.6, 1200, 150, 'lowpass');
    },
    // Out of energy: a dry click
    empty: () => tone('square', 180, 120, 0.04, 0.3),
    // A threat wearing integrity down: a low, rough buzz
    hit: () => {
      tone('sawtooth', 70, 45, 0.18, 0.6);
      burst(0.1, 0.5, 900, 300, 'lowpass');
    },
    // A threat shattering into voxels
    shatter: () => {
      burst(0.35, 0.8, 5000, 600);
      tone('triangle', 900, 120, 0.3, 0.25);
    },
    // A kill: a sharp, falling digital chirp over a low thump, distinct from the shot itself
    kill: () => {
      tone('square', 1760, 440, 0.12, 0.28);
      tone('square', 1320, 330, 0.1, 0.18, 0.06);
      tone('sine', 140, 40, 0.22, 0.9);
    },
    // Integrity gone: a long falling drone, a system powering down
    failure: () => {
      tone('sawtooth', 220, 30, 1.4, 0.45);
      tone('sine', 110, 25, 1.6, 0.8);
      burst(0.9, 0.4, 1800, 80, 'lowpass', 0.1);
    },
    // A blast door sliding open: a mechanical rumble and a hiss of air
    hiss: () => {
      tone('sawtooth', 55, 40, 0.7, 0.35);
      burst(0.7, 0.55, 2500, 300, 'bandpass', 0.05);
    },
    // A line of dialogue starting
    talk: () => tone('triangle', 440, 660, 0.08, 0.3),
    // The command hub coming online: two soft rising chimes, "access granted"
    access: () => {
      tone('sine', 660, 880, 0.12, 0.3);
      tone('sine', 990, 1320, 0.16, 0.26, 0.11);
      tone('triangle', 1980, 1980, 0.06, 0.06, 0.11);
    },
    // The vault's laser grid powering down: a falling electric whine and a soft crackle
    lasers: () => {
      tone('sawtooth', 1200, 90, 0.55, 0.12);
      tone('square', 600, 60, 0.4, 0.06, 0.05);
      burst(0.25, 0.25, 3000, 400, 'bandpass', 0.1);
    },
    // A dossier typing out: a very quiet, short key tick (throttled by the caller)
    tick: () => tone('square', 1500, 1300, 0.012, 0.04),
  };
};
