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

// Play Omnitrix-style circular mechanical activation sound
// Original synthesized frequency sweep + mechanical snap
export const playAlertActivationSound = (priority: string = "NORMAL") => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Dual electronic detection beep
    const beepOsc = ctx.createOscillator();
    const beepGain = ctx.createGain();
    beepOsc.type = "sine";
    beepOsc.frequency.setValueAtTime(880, now); // A5
    beepOsc.frequency.setValueAtTime(1320, now + 0.08); // E6
    beepGain.gain.setValueAtTime(0.18, now);
    beepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    beepOsc.connect(beepGain);
    beepGain.connect(ctx.destination);
    beepOsc.start(now);
    beepOsc.stop(now + 0.25);

    // 2. Rising mechanical spin / energy ramp (0.2s - 0.7s)
    const spinOsc = ctx.createOscillator();
    const spinGain = ctx.createGain();
    const spinFilter = ctx.createBiquadFilter();

    spinOsc.type = priority === "HIGH" ? "sawtooth" : "triangle";
    spinOsc.frequency.setValueAtTime(220, now + 0.2);
    spinOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.75); // rapid frequency spin up

    spinFilter.type = "bandpass";
    spinFilter.frequency.setValueAtTime(400, now + 0.2);
    spinFilter.frequency.exponentialRampToValueAtTime(2400, now + 0.75);
    spinFilter.Q.value = 4.0;

    spinGain.gain.setValueAtTime(0.01, now + 0.2);
    spinGain.gain.linearRampToValueAtTime(0.15, now + 0.65);
    spinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    spinOsc.connect(spinFilter);
    spinFilter.connect(spinGain);
    spinGain.connect(ctx.destination);
    spinOsc.start(now + 0.2);
    spinOsc.stop(now + 0.85);

    // 3. Mechanical Lock / Snap impact at 0.8s
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = "square";
    snapOsc.frequency.setValueAtTime(240, now + 0.8);
    snapOsc.frequency.exponentialRampToValueAtTime(60, now + 0.95); // thump
    snapGain.gain.setValueAtTime(0.25, now + 0.8);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now + 0.8);
    snapOsc.stop(now + 1.1);
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

