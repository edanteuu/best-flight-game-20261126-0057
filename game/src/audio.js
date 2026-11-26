// Sound, synthesised live with WebAudio — no audio files. An engine hum that
// follows the throttle, wind that grows with speed, a two-note chime when a ring
// is flown, and a low thud for touchdown. Everything starts on the first user
// gesture (browsers require it) and M toggles mute.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let windSource = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      // Engine: two detuned sawtooth oscillators through a low-pass filter.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 71.5;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped filtered noise.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
    } catch {
      ctx = null;
    }
  }

  /** Update the continuous sounds from the flight state, every frame. */
  function update(throttle, speedKnots, airborne) {
    if (!ctx || muted) {
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return;
    }
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.09 : 0.02, t, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + throttle * 90, t, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.12, (speedKnots / 200) * 0.12), t, 0.2);
  }

  function tone(freq, at, dur, type, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol || 0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Two-note chime when a ring is flown. */
  function ringChime() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(880, t, 0.28, 'sine', 0.25);
    tone(1318, t + 0.1, 0.4, 'sine', 0.22);
  }

  /** Low thud for touchdown, and a crunch for a hard landing. */
  function touchdown(hard) {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(hard ? 55 : 75, t, hard ? 0.5 : 0.3, 'sine', hard ? 0.5 : 0.35);
    tone(140, t, 0.18, 'triangle', 0.2);
  }

  /** Descending buzz for a crash. */
  function crash() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(220, t, 0.7, 'sawtooth', 0.25);
    tone(110, t + 0.05, 0.7, 'sawtooth', 0.22);
    tone(55, t + 0.1, 0.9, 'sine', 0.4);
  }

  /** Short click for menu buttons. */
  function click() {
    if (!ctx) return;
    tone(660, ctx.currentTime, 0.08, 'square', 0.08);
  }

  /** A soft warning beep when fuel drops under 20% (called by the loop's HUD). */
  function lowFuelBeep() {
    if (!ctx) return;
    tone(440, ctx.currentTime, 0.15, 'square', 0.07);
  }

  return {
    ensure,
    update,
    ringChime,
    touchdown,
    crash,
    click,
    lowFuelBeep,
    toggleMute() {
      muted = !muted;
      if (muted && engineGain) engineGain.gain.value = 0;
      if (muted && windGain) windGain.gain.value = 0;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
