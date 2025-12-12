// Simple Web Audio API synthesizer

let audioCtx: AudioContext | null = null;
let bgmInterval: number | null = null;
let bgmGain: GainNode | null = null;

const initAudio = (): AudioContext | null => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Check if context is usable
    if (!Number.isFinite(audioCtx.currentTime)) {
      return null;
    }
    return audioCtx;
  } catch {
    return null;
  }
};

// Safe wrapper to check if a time value is usable
const isValidTime = (time: number): boolean => Number.isFinite(time) && time >= 0;

// Unlock audio on iOS - must be called during a user gesture
export const unlockAudio = () => {
  const ctx = initAudio();
  if (!ctx) return;
  // Create and immediately play a silent buffer to unlock audio on iOS
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
};

// Play a short "pluck" sound (Marimba-ish)
const playNote = (ctx: AudioContext, freq: number, time: number, vol = 0.1) => {
  // Validate all time values are finite
  if (!isValidTime(time) || !Number.isFinite(freq) || !Number.isFinite(vol)) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);

  // Envelope for a pluck sound
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

  osc.start(time);
  osc.stop(time + 0.6);
};

export const startBackgroundMusic = () => {
  const ctx = initAudio();
  if (!ctx) return;
  if (bgmInterval !== null) return; // Already playing

  let step = 0;
  // C Major Pentatonic: C4, D4, E4, G4, A4, C5
  const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

  // A simple 8-step melody pattern (indexes into scale)
  const melody = [0, 2, 3, 4, 3, 2, 0, 4];

  const tempo = 200; // ms per note

  const playLoop = () => {
    const now = ctx.currentTime;
    if (!isValidTime(now)) return; // Skip if time is invalid

    // Play main melody note
    const noteIndex = melody[step % melody.length];
    // Add some variation every 4th bar
    const octave = Math.floor(step / 16) % 2 === 1 ? 2 : 1;

    playNote(ctx, scale[noteIndex] * octave, now, 0.05);

    // Occasional harmony note
    if (step % 4 === 0) {
      playNote(ctx, scale[(noteIndex + 2) % scale.length] * 0.5, now, 0.03);
    }

    step++;
  };

  playLoop(); // Play first immediately
  bgmInterval = window.setInterval(playLoop, tempo);
};

export const stopBackgroundMusic = () => {
  if (bgmInterval) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }
  if (bgmGain) {
    try { bgmGain.disconnect(); } catch (e) {}
    bgmGain = null;
  }
};

export const playMatchSound = (playerIndex: number, isHuman: boolean) => {
  try {
    const ctx = initAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (!isValidTime(now)) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isHuman) {
      // Bright "Coin" sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, now); // C6
      osc.frequency.exponentialRampToValueAtTime(2093.00, now + 0.1); // C7

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      // Bot sound: Lower woodblock/pop
      // Distinct pitch per bot
      const pitches = [392.00, 329.63, 261.63, 196.00, 440.00];
      const pitch = pitches[playerIndex % pitches.length];

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // Silently ignore audio errors in headless/unsupported contexts
  }
};

export const playErrorSound = () => {
  try {
    const ctx = initAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (!isValidTime(now)) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Dull "Thud"
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

    // Lowpass filter to make it duller
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    osc.disconnect();
    osc.connect(filter);
    filter.connect(gain);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.start();
    osc.stop(now + 0.3);
  } catch {
    // Silently ignore audio errors in headless/unsupported contexts
  }
};