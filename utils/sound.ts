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
      // Safari requires resume() to be called - fire and forget but it will complete
      audioCtx.resume().catch(() => {});
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

// Unlock audio on iOS/Safari - MUST be called during a user gesture (click/tap)
export const unlockAudio = () => {
  try {
    // Create context if needed
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume if suspended - Safari requires this during user gesture
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    // Create and play a silent buffer to fully unlock audio on iOS/Safari
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch {
    // Ignore errors - audio just won't work
  }
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

    playNote(ctx, scale[noteIndex] * octave, now, 0.15);

    // Occasional harmony note
    if (step % 4 === 0) {
      playNote(ctx, scale[(noteIndex + 2) % scale.length] * 0.5, now, 0.1);
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

// Victory celebration sound - fanfare with sparkles
export const playVictorySound = () => {
  try {
    const ctx = initAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (!isValidTime(now)) return;

    // Fanfare notes - triumphant ascending arpeggio
    const fanfareNotes = [
      { freq: 523.25, time: 0 },      // C5
      { freq: 659.25, time: 0.15 },   // E5
      { freq: 783.99, time: 0.3 },    // G5
      { freq: 1046.50, time: 0.45 },  // C6
      { freq: 1318.51, time: 0.6 },   // E6
      { freq: 1567.98, time: 0.75 },  // G6
    ];

    // Play fanfare notes
    fanfareNotes.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.2, now + time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, now + time + 0.4);

      osc.start(now + time);
      osc.stop(now + time + 0.5);
    });

    // Sparkle/shimmer effect - random high-pitched tones
    for (let i = 0; i < 12; i++) {
      const sparkleTime = Math.random() * 1.5;
      const sparkleFreq = 2000 + Math.random() * 2000; // 2000-4000 Hz

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(sparkleFreq, now + sparkleTime);

      gain.gain.setValueAtTime(0, now + sparkleTime);
      gain.gain.linearRampToValueAtTime(0.08, now + sparkleTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + sparkleTime + 0.15);

      osc.start(now + sparkleTime);
      osc.stop(now + sparkleTime + 0.2);
    }

    // Final chord - sustained triumph
    const chordFreqs = [523.25, 659.25, 783.99, 1046.50]; // C major chord
    chordFreqs.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 1);

      gain.gain.setValueAtTime(0, now + 1);
      gain.gain.linearRampToValueAtTime(0.15, now + 1.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);

      osc.start(now + 1);
      osc.stop(now + 2.6);
    });
  } catch {
    // Silently ignore audio errors in headless/unsupported contexts
  }
};