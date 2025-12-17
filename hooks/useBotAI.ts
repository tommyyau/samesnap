import { useRef, useEffect, useCallback } from 'react';
import { Player, CardData, GameState, Difficulty } from '../shared/types';
import { BOT_SPEEDS } from '../constants';

interface UseBotAIOptions {
  players: Player[];
  centerCard: CardData | null;
  gameState: GameState;
  difficulty: Difficulty;
  onBotMatch: (botId: string, centerCard: CardData) => void;
}

interface UseBotAIResult {
  clearAllBotTimers: () => void;
}

export function useBotAI({
  players,
  centerCard,
  gameState,
  difficulty,
  onBotMatch,
}: UseBotAIOptions): UseBotAIResult {
  const botTimers = useRef<{ [key: string]: number }>({});
  // Use ref to avoid stale closure issues with the callback
  const onBotMatchRef = useRef(onBotMatch);
  onBotMatchRef.current = onBotMatch;

  // Clear all bot timers
  const clearAllBotTimers = useCallback(() => {
    Object.values(botTimers.current).forEach((t) => clearTimeout(t as number));
    botTimers.current = {};
  }, []);

  // Bot scheduling effect - runs when center card or game state changes
  useEffect(() => {
    // Only schedule bots if the game is actively playing
    if (gameState !== GameState.PLAYING || !centerCard) {
      return;
    }

    const currentCenter = centerCard;

    // Schedule each bot that still has cards
    players.forEach((player) => {
      if (player.isBot && player.cardStack.length > 0) {
        // Clear any existing timer for this bot
        if (botTimers.current[player.id]) {
          clearTimeout(botTimers.current[player.id]);
        }

        const speedRange = BOT_SPEEDS[difficulty];
        // Random delay based on difficulty
        const reactionTime =
          Math.random() * (speedRange[1] - speedRange[0]) + speedRange[0];

        botTimers.current[player.id] = window.setTimeout(() => {
          // Use ref to always get the latest callback
          onBotMatchRef.current(player.id, currentCenter);
        }, reactionTime);
      }
    });

    // Cleanup on unmount or when dependencies change
    return () => clearAllBotTimers();
  }, [centerCard, gameState, players, difficulty, clearAllBotTimers]);

  return { clearAllBotTimers };
}
