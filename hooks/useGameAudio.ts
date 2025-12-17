import { useEffect, useCallback, useRef } from 'react';
import {
  startBackgroundMusic,
  stopBackgroundMusic,
  playMatchSound as playSoundMatch,
  playErrorSound as playSoundError,
  playVictorySound as playSoundVictory,
  unlockAudio as unlockSoundAudio,
} from '../utils/sound';

interface UseGameAudioOptions {
  /** Whether the game is currently in playing phase */
  isPlaying: boolean;
  /** Whether the game has ended */
  isGameOver: boolean;
}

interface UseGameAudioResult {
  /** Play match sound - pass playerIndex for bot sounds, isHuman for human celebration */
  playMatch: (playerIndex: number, isHuman: boolean) => void;
  /** Play error/penalty sound */
  playError: () => void;
  /** Play victory fanfare */
  playVictory: () => void;
  /** Unlock audio context (required for Safari on first user gesture) */
  unlockAudio: () => void;
  /** Manually stop background music (called automatically on game over/unmount) */
  stopMusic: () => void;
}

/**
 * Hook to manage game audio lifecycle and sound effects.
 *
 * Automatically:
 * - Starts background music when isPlaying becomes true
 * - Stops music when isGameOver becomes true or component unmounts
 *
 * Returns functions to trigger sound effects at appropriate moments.
 */
export function useGameAudio({ isPlaying, isGameOver }: UseGameAudioOptions): UseGameAudioResult {
  // Track if we've started music to avoid double-starts
  const musicStartedRef = useRef(false);

  // Start music when game enters playing state
  useEffect(() => {
    if (isPlaying && !musicStartedRef.current) {
      startBackgroundMusic();
      musicStartedRef.current = true;
    }
  }, [isPlaying]);

  // Stop music when game ends
  useEffect(() => {
    if (isGameOver && musicStartedRef.current) {
      stopBackgroundMusic();
      musicStartedRef.current = false;
    }
  }, [isGameOver]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBackgroundMusic();
      musicStartedRef.current = false;
    };
  }, []);

  // Memoized sound effect functions
  const playMatch = useCallback((playerIndex: number, isHuman: boolean) => {
    playSoundMatch(playerIndex, isHuman);
  }, []);

  const playError = useCallback(() => {
    playSoundError();
  }, []);

  const playVictory = useCallback(() => {
    playSoundVictory();
  }, []);

  const unlockAudio = useCallback(() => {
    unlockSoundAudio();
  }, []);

  const stopMusic = useCallback(() => {
    stopBackgroundMusic();
    musicStartedRef.current = false;
  }, []);

  return {
    playMatch,
    playError,
    playVictory,
    unlockAudio,
    stopMusic,
  };
}
