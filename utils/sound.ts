// Simple Web Audio API synthesizer

let audioCtx: AudioContext | null = null;
let bgmInterval: number | null = null;
let audioUnlocked = false;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// iOS Safari requires AudioContext to be unlocked by a user gesture
// Call this function on first user interaction (tap/click)
export const unlockAudio = () => {
  if (audioUnlocked) return;

  const ctx = initAudio();

  // Create a silent buffer and play it to unlock audio
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);

  // Also resume if suspended
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  audioUnlocked = true;
  console.log('Audio unlocked for iOS');
};

// Play a short "pluck" sound (Marimba-ish)
const playNote = (ctx: AudioContext, freq: number, time: number, vol = 0.1) => {
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
  if (bgmInterval !== null) return; // Already playing

  let step = 0;
  // C Major Pentatonic: C4, D4, E4, G4, A4, C5
  const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
  
  // A simple 8-step melody pattern (indexes into scale)
  const melody = [0, 2, 3, 4, 3, 2, 0, 4]; 
  
  const tempo = 200; // ms per note

  const playLoop = () => {
    const now = ctx.currentTime;
    
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
};

export const playMatchSound = (playerIndex: number, isHuman: boolean) => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;

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
};

export const playErrorSound = () => {
  const ctx = initAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  // Dull "Thud"
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);

  // Lowpass filter to make it duller
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  osc.disconnect();
  osc.connect(filter);
  filter.connect(gain);

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};