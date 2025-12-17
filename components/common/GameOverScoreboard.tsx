import React from 'react';
import { Trophy } from 'lucide-react';

export interface PlayerScore {
  id: string;
  name: string;
  cardsRemaining: number;
  isYou?: boolean;
  wantsRematch?: boolean;
}

interface GameOverScoreboardProps {
  players: PlayerScore[];
  isPlayerWinner: boolean;
  winnerName: string;
  onPlayAgain: () => void;
  onExit: () => void;
  // Multiplayer-specific options
  variant?: 'singleplayer' | 'multiplayer';
  isLastPlayerStanding?: boolean;
  rejoinTimeLeft?: number;
  playersWantingRematchCount?: number;
  canPlayAgain?: boolean;
  waitingForOthers?: boolean;
  playAgainLabel?: string;
  exitLabel?: string;
}

export const GameOverScoreboard: React.FC<GameOverScoreboardProps> = ({
  players,
  isPlayerWinner,
  winnerName,
  onPlayAgain,
  onExit,
  variant = 'singleplayer',
  isLastPlayerStanding = false,
  rejoinTimeLeft = 0,
  playersWantingRematchCount = 0,
  canPlayAgain = true,
  waitingForOthers = false,
  playAgainLabel = 'Play Again',
  exitLabel = 'Exit',
}) => {
  const isMultiplayer = variant === 'multiplayer';

  // Header text based on game end reason
  const renderHeader = () => {
    if (isLastPlayerStanding && isPlayerWinner) {
      return (
        <>
          <h2 className="text-4xl font-bold mb-2">Last One Standing!</h2>
          <p className="text-gray-500 mb-6">Everyone else left - You win!</p>
        </>
      );
    }
    return (
      <>
        <h2 className="text-4xl font-bold mb-2">
          {isPlayerWinner ? 'You Won!' : `${winnerName} Wins!`}
        </h2>
        <p className="text-gray-500 mb-6">Final Standings</p>
      </>
    );
  };

  // Player row - different styling for multiplayer
  const renderPlayerRow = (player: PlayerScore, idx: number) => {
    const isWinner = player.cardsRemaining === 0;
    const rowBgClass = isMultiplayer && player.isYou ? 'bg-indigo-100' : 'bg-gray-100';

    return (
      <div
        key={player.id}
        className={`flex justify-between items-center p-3 rounded-xl font-bold ${rowBgClass}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400 w-6">#{idx + 1}</span>
          <span>{player.name}</span>
          {isMultiplayer && player.isYou && (
            <span className="text-xs text-indigo-500">(You)</span>
          )}
          {isMultiplayer && player.wantsRematch && (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              Ready
            </span>
          )}
        </div>
        <span className={isWinner ? 'text-green-600' : 'text-indigo-600'}>
          {isWinner ? 'WINNER!' : player.cardsRemaining}
        </span>
      </div>
    );
  };

  // Multiplayer rejoin status
  const renderRejoinStatus = () => {
    if (!isMultiplayer || rejoinTimeLeft <= 0) return null;

    return (
      <div className="mb-4 text-sm text-gray-500">
        {playersWantingRematchCount > 0 ? (
          <span>{playersWantingRematchCount} player(s) ready for rematch</span>
        ) : (
          <span>Rematch window: {rejoinTimeLeft}s</span>
        )}
      </div>
    );
  };

  // Buttons - different layout for singleplayer vs multiplayer
  const renderButtons = () => {
    if (isMultiplayer) {
      return (
        <div className="flex gap-3 justify-center">
          {canPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition"
            >
              {playAgainLabel}
            </button>
          )}
          {waitingForOthers && rejoinTimeLeft > 0 && (
            <button
              disabled
              className="px-6 py-3 rounded-xl bg-gray-400 text-white font-bold cursor-not-allowed"
            >
              Waiting for others... ({rejoinTimeLeft}s)
            </button>
          )}
          <button
            onClick={onExit}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition"
          >
            {exitLabel}
          </button>
        </div>
      );
    }

    // Single-player buttons
    return (
      <div className="flex gap-4 justify-center shrink-0">
        <button
          onClick={onExit}
          className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 transition"
        >
          {exitLabel}
        </button>
        <button
          onClick={onPlayAgain}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg"
        >
          {playAgainLabel}
        </button>
      </div>
    );
  };

  // Container class differs slightly between modes
  const containerClass = isMultiplayer
    ? 'bg-white text-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center'
    : 'bg-white text-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center flex flex-col max-h-[90vh]';

  const standingsClass = isMultiplayer
    ? 'space-y-3 mb-6'
    : 'space-y-3 mb-8 overflow-y-auto flex-1';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white p-4">
      <div className={containerClass}>
        <div className={isMultiplayer ? '' : 'shrink-0'}>
          <Trophy
            className={`w-24 h-24 mx-auto mb-4 ${isPlayerWinner ? 'text-yellow-400' : 'text-gray-400'}`}
          />
          {renderHeader()}
        </div>

        <div className={standingsClass}>
          {players.map((player, idx) => renderPlayerRow(player, idx))}
        </div>

        {renderRejoinStatus()}
        {renderButtons()}
      </div>
    </div>
  );
};

export default GameOverScoreboard;
