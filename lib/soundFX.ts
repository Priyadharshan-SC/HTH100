// Web Audio API Synthesizer for sci-fi alert and voice cues
// Works 100% offline, zero external asset dependencies, zero missing file issues

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

export const setSoundEnabled = (enabled: boolean) => {
  soundEnabled = enabled;
};

export const isSoundEnabled = () => soundEnabled;

export const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

// Play Omnitrix-style circular mechanical activation sound with loud, commanding klaxon
// Uses Web Audio API dynamics compression to maximize loudness without clipping
export const playAlertActivationSound = (priority: string = "NORMAL") => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Master Dynamics Compressor to ensure maximum loudness without clipping/distortion
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-4, now);
    compressor.knee.setValueAtTime(6, now);
    compressor.ratio.setValueAtTime(12, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.12, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.95, now); // Loud commanding master output
    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    const isHigh = priority === "HIGH" || priority === "URGENT";

    // 1. Loud Piercing Dual Attention Chime (0.0s - 0.3s)
    // Chime Pulse 1 (0.0s): Dual tone B5 (987.77Hz) + E6 (1318.5Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(987.77, now);
    osc1.frequency.setValueAtTime(1318.5, now + 0.05);

    const filter1 = ctx.createBiquadFilter();
    filter1.type = "lowpass";
    filter1.frequency.setValueAtTime(3200, now);

    gain1.gain.setValueAtTime(0.85, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Chime Pulse 2 (0.12s): Higher octave E6 (1318.5Hz) + B6 (1975.5Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(1318.5, now + 0.12);
    osc2.frequency.setValueAtTime(1975.5, now + 0.18);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = "lowpass";
    filter2.frequency.setValueAtTime(4000, now + 0.12);

    gain2.gain.setValueAtTime(0.9, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);

    // Sine reinforcement for foundational power
    const subChime = ctx.createOscillator();
    const subGain = ctx.createGain();
    subChime.type = "sine";
    subChime.frequency.setValueAtTime(659.25, now);
    subChime.frequency.setValueAtTime(987.77, now + 0.12);
    subGain.gain.setValueAtTime(0.7, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
    subChime.connect(subGain);
    subGain.connect(masterGain);
    subChime.start(now);
    subChime.stop(now + 0.35);

    // 2. Sci-Fi Rising Spin-up & Alert Siren (0.3s - 0.75s)
    const spinOsc = ctx.createOscillator();
    const spinGain = ctx.createGain();
    const spinFilter = ctx.createBiquadFilter();

    spinOsc.type = isHigh ? "sawtooth" : "triangle";
    spinOsc.frequency.setValueAtTime(320, now + 0.28);
    spinOsc.frequency.exponentialRampToValueAtTime(2200, now + 0.72);

    // LFO Siren Warble Effect
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(isHigh ? 24 : 16, now + 0.28); // Rapid warble
    lfoGain.gain.setValueAtTime(80, now + 0.28);
    lfo.connect(spinOsc.frequency);
    lfo.start(now + 0.28);
    lfo.stop(now + 0.75);

    spinFilter.type = "bandpass";
    spinFilter.frequency.setValueAtTime(600, now + 0.28);
    spinFilter.frequency.exponentialRampToValueAtTime(3000, now + 0.72);
    spinFilter.Q.value = 3.5;

    spinGain.gain.setValueAtTime(0.05, now + 0.28);
    spinGain.gain.linearRampToValueAtTime(0.8, now + 0.65);
    spinGain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

    spinOsc.connect(spinFilter);
    spinFilter.connect(spinGain);
    spinGain.connect(masterGain);
    spinOsc.start(now + 0.28);
    spinOsc.stop(now + 0.76);

    // 3. Mechanical Lock / Snap & Sub-Bass Thud (0.75s - 1.1s)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = "square";
    snapOsc.frequency.setValueAtTime(350, now + 0.75);
    snapOsc.frequency.exponentialRampToValueAtTime(50, now + 0.95);
    snapGain.gain.setValueAtTime(0.9, now + 0.75);
    snapGain.gain.exponentialRampToValueAtTime(0.005, now + 1.1);

    snapOsc.connect(snapGain);
    snapGain.connect(masterGain);
    snapOsc.start(now + 0.75);
    snapOsc.stop(now + 1.15);

    // Sub-bass heavy thump on lock
    const subThump = ctx.createOscillator();
    const subThumpGain = ctx.createGain();
    subThump.type = "sine";
    subThump.frequency.setValueAtTime(140, now + 0.75);
    subThump.frequency.exponentialRampToValueAtTime(35, now + 1.05);
    subThumpGain.gain.setValueAtTime(0.85, now + 0.75);
    subThumpGain.gain.exponentialRampToValueAtTime(0.005, now + 1.1);

    subThump.connect(subThumpGain);
    subThumpGain.connect(masterGain);
    subThump.start(now + 0.75);
    subThump.stop(now + 1.15);

    // Metallic latch transient click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(3200, now + 0.75);
    clickGain.gain.setValueAtTime(0.7, now + 0.75);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);

    clickOsc.connect(clickGain);
    clickGain.connect(masterGain);
    clickOsc.start(now + 0.75);
    clickOsc.stop(now + 0.85);

    // Extra urgent second chime for URGENT / HIGH priority alerts
    if (isHigh) {
      const urgentOsc = ctx.createOscillator();
      const urgentGain = ctx.createGain();
      urgentOsc.type = "sawtooth";
      urgentOsc.frequency.setValueAtTime(1760, now + 0.9);
      urgentOsc.frequency.setValueAtTime(2640, now + 1.05);
      urgentGain.gain.setValueAtTime(0.85, now + 0.9);
      urgentGain.gain.exponentialRampToValueAtTime(0.01, now + 1.25);

      urgentOsc.connect(urgentGain);
      urgentGain.connect(masterGain);
      urgentOsc.start(now + 0.9);
      urgentOsc.stop(now + 1.3);
    }
  } catch (err) {
    console.warn("Sound effect synthesis error:", err);
  }
};

// Play Voice broadcast live activation cue
export const playVoiceStartCue = () => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.5, now + 0.3); // C6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  } catch (err) {
    console.warn("Voice cue error:", err);
  }
};

// Play Voice broadcast end cue
export const playVoiceEndCue = () => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(783.99, now); // G5
    osc.frequency.setValueAtTime(523.25, now + 0.15); // C5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (err) {
    console.warn("Voice end cue error:", err);
  }
};

let activeStreamSource: MediaStreamAudioSourceNode | null = null;

// Route WebRTC MediaStream directly through Web Audio API to bypass HTML5 element restrictions
export const routeMediaStreamToAudioContext = (stream: MediaStream): MediaStreamAudioSourceNode | null => {
  const ctx = getAudioContext();
  if (!ctx) return null;

  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    if (activeStreamSource) {
      try {
        activeStreamSource.disconnect();
      } catch {}
      activeStreamSource = null;
    }

    const source = ctx.createMediaStreamSource(stream);
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(1.0, ctx.currentTime);

    source.connect(voiceGain);
    voiceGain.connect(ctx.destination);
    activeStreamSource = source;
    return source;
  } catch (err) {
    console.warn("Web Audio API stream routing notice:", err);
    return null;
  }
};

