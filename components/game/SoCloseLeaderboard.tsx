import { useState, useEffect, useMemo } from 'react';
import { SoCloseEntry } from '../../shared/types';

// Happy emojis for winner
const HAPPY_EMOJIS = ['😄', '🤩', '😊', '🥳'];

// Sad/angry emojis for everyone else (randomly assigned)
const SAD_EMOJIS = ['😢', '😤', '😭', '😠', '😩', '🥺', '😡', '😿', '💢'];

interface SoCloseLeaderboardProps {
  winnerId: string;
  winnerName: string;
  soCloseEntries: SoCloseEntry[];
  currentPlayerId?: string;
}

export function SoCloseLeaderboard({
  winnerId,
  winnerName,
  soCloseEntries,
  currentPlayerId,
}: SoCloseLeaderboardProps) {
  // Track how many entries are visible (animate them appearing one by one)
  const [visibleCount, setVisibleCount] = useState(0);

  // Generate random emojis for each entry (memoized so they don't change)
  const emojiAssignments = useMemo(() => {
    const winnerEmoji = HAPPY_EMOJIS[Math.floor(Math.random() * HAPPY_EMOJIS.length)];
    const loserEmojis = soCloseEntries.map(() =>
      SAD_EMOJIS[Math.floor(Math.random() * SAD_EMOJIS.length)]
    );
    return { winnerEmoji, loserEmojis };
  }, [soCloseEntries.length]);

  // Animate entries appearing one by one
  useEffect(() => {
    // Start with 0 visible, then reveal winner + entries one by one
    setVisibleCount(0);
    const totalEntries = 1 + soCloseEntries.length; // 1 for winner
    let current = 0;

    const timer = setInterval(() => {
      current++;
      setVisibleCount(current);
      if (current >= totalEntries) {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [soCloseEntries.length]);

  const formatDelta = (ms: number) => {
    return `+${(ms / 1000).toFixed(2)}s`;
  };

  const isCurrentPlayer = (playerId: string) => playerId === currentPlayerId;
  const currentPlayerIsInList = soCloseEntries.some(e => e.playerId === currentPlayerId);

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 min-w-[280px] max-w-[400px] shadow-2xl">
      <h2 className="text-xl sm:text-2xl font-black text-white text-center mb-4">
        So Close!
      </h2>

      <div className="space-y-2">
        {/* Winner - 1st place */}
        {visibleCount >= 1 && (
          <div
            className={`flex items-center gap-3 py-2 px-4 rounded-xl transition-all duration-300 animate-fade-in ${
              isCurrentPlayer(winnerId)
                ? 'bg-green-500/40 ring-2 ring-green-400'
                : 'bg-white/10'
            }`}
          >
            <span className="text-3xl">{emojiAssignments.winnerEmoji}</span>
            <span className="text-white font-bold flex-1 truncate">{winnerName}</span>
            <span className="text-green-400 font-mono text-sm font-bold">WINNER</span>
          </div>
        )}

        {/* Close call entries */}
        {soCloseEntries.slice(0, 5).map((entry, index) =>
          visibleCount >= index + 2 ? (
            <div
              key={entry.playerId}
              className={`flex items-center gap-3 py-2 px-4 rounded-xl transition-all duration-300 animate-fade-in ${
                isCurrentPlayer(entry.playerId)
                  ? 'bg-amber-500/40 ring-2 ring-amber-400'
                  : 'bg-white/5'
              }`}
            >
              <span className="text-2xl">{emojiAssignments.loserEmojis[index]}</span>
              <span className="text-white/90 font-medium flex-1 truncate">
                {entry.playerName}
              </span>
              <span className="text-amber-400 font-mono text-sm">
                {formatDelta(entry.deltaMs)}
              </span>
            </div>
          ) : null
        )}
      </div>

      {/* Encouragement message if current player was close */}
      {currentPlayerIsInList && visibleCount > soCloseEntries.length && (
        <div className="text-center text-amber-300 text-sm mt-4 animate-pulse">
          Almost had it! Be faster next time!
        </div>
      )}
    </div>
  );
}
