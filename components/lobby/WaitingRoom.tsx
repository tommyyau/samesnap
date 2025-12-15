import React, { useState, useEffect } from 'react';
import { Copy, Check, Crown, Wifi, WifiOff, Play, LogOut, Users, Clock, AlertCircle } from 'lucide-react';
import { CardDifficulty, GameDuration, RoomPhase } from '../../shared/types';
import type { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { unlockAudio, startBackgroundMusic } from '../../utils/sound';

interface WaitingRoomProps {
  roomCode: string;
  playerName: string;
  onLeave: () => void;
  multiplayerHook: ReturnType<typeof useMultiplayerGame>;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomCode, onLeave, multiplayerHook }) => {
  const [copied, setCopied] = useState(false);
  // Local state for host controls - always synced from server config when it changes
  const [cardDifficulty, setCardDifficulty] = useState<CardDifficulty | null>(null);
  const [gameDuration, setGameDuration] = useState<GameDuration>(GameDuration.SHORT);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { roomState, isConnected, isHost, latency, connectionError, setConfig, startGame, leaveRoom, clearError } = multiplayerHook;

  // Always sync local state FROM server config when it changes
  // This ensures new hosts see the correct config after host transfer
  useEffect(() => {
    if (roomState?.config) {
      setCardDifficulty(roomState.config.cardDifficulty);
      setGameDuration(roomState.config.gameDuration);
    }
  }, [roomState?.config?.cardDifficulty, roomState?.config?.gameDuration]);

  // Handler for when host explicitly changes card difficulty
  const handleCardDifficultyChange = (newDifficulty: CardDifficulty) => {
    setCardDifficulty(newDifficulty);
    if (isHost && roomState?.phase === RoomPhase.WAITING) {
      setConfig({ cardDifficulty: newDifficulty, gameDuration });
    }
  };

  // Handler for when host explicitly changes game duration
  const handleGameDurationChange = (newDuration: GameDuration) => {
    setGameDuration(newDuration);
    if (isHost && roomState?.phase === RoomPhase.WAITING) {
      setConfig({ cardDifficulty: cardDifficulty ?? CardDifficulty.EASY, gameDuration: newDuration });
    }
  };

  // Note: Navigation to game is now handled by MultiplayerWrapper in App.tsx

  // Room timeout countdown
  useEffect(() => {
    if (!roomState?.roomExpiresAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((roomState.roomExpiresAt! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [roomState?.roomExpiresAt]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    // Unlock audio on iOS/Safari - must happen during user gesture
    unlockAudio();
    startBackgroundMusic();
    startGame({
      cardDifficulty: cardDifficulty ?? CardDifficulty.EASY,
      gameDuration,
    });
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  const currentPlayers = roomState?.players.length || 0;
  const canStart = isHost && currentPlayers >= 2;

  const handleErrorRetry = () => {
    clearError();
    // Socket will automatically reconnect
  };

  const handleErrorLeave = () => {
    clearError();
    onLeave();
  };

  return (
    <>
      {/* Connection Error Modal */}
      {connectionError && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-red-500 mb-4">
              <AlertCircle size={48} className="mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Connection Error</h3>
            <p className="text-gray-600 mb-6">{connectionError}</p>
            <div className="flex gap-3">
              <button
                onClick={handleErrorLeave}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Back to Menu
              </button>
              <button
                onClick={handleErrorRetry}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
        {/* Connection Status */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected ? `Connected (${latency}ms)` : 'Disconnected'}
          </div>
        </div>

        {/* Room Code */}
        <div className="text-center mb-4">
          <p className="text-gray-500 text-sm mb-1">ROOM CODE</p>
          <div
            onClick={copyRoomCode}
            className="text-5xl font-black tracking-widest text-indigo-600 cursor-pointer hover:text-indigo-500 flex items-center justify-center gap-2"
          >
            {roomCode}
            {copied ? <Check size={24} className="text-green-500" /> : <Copy size={24} />}
          </div>
          <p className="text-gray-400 text-xs mt-1">Click to copy</p>
        </div>

        {/* Prominent Countdown Timer */}
        {timeLeft !== null && timeLeft > 0 && (
          <div className="text-center mb-4 p-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-2xl border-2 border-orange-300">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Clock size={32} className="text-orange-600 animate-pulse" />
              <span className="text-4xl font-black text-orange-600">{timeLeft}s</span>
            </div>
            <p className="text-sm text-orange-700 font-medium">
              Game starts when timer ends
            </p>
            <p className="text-xs text-orange-500 mt-1">
              {isHost ? 'Or click "Start Now" with 2+ players' : 'Host can start early with 2+ players'}
            </p>
          </div>
        )}

        {/* Status Messages */}
        {currentPlayers < 2 && (
          <div className="text-center mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-center justify-center gap-2 text-red-700 font-bold">
              <Users size={20} />
              Need at least 1 friend to play!
            </div>
            <p className="text-xs text-red-500 mt-1">
              Share the room code above
            </p>
          </div>
        )}

        {currentPlayers >= 2 && (
          <div className="text-center mb-4 p-3 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
              <Check size={20} />
              Ready to play! ({currentPlayers} player{currentPlayers !== 1 ? 's' : ''})
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-700 mb-2">
            Players ({currentPlayers}/8 max)
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {roomState?.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  player.isYou ? 'bg-indigo-100 border-2 border-indigo-300' : 'bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {player.isHost && <Crown size={16} className="text-yellow-500" />}
                  <span className="font-semibold">{player.name}</span>
                  {player.isYou && <span className="text-xs text-indigo-500">(You)</span>}
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  player.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Game Settings (Host Only) - Card Layout */}
        {isHost && (
          <div className="mb-4">
            <p className="text-sm font-bold text-gray-700 mb-2">Card Layout</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleCardDifficultyChange(CardDifficulty.EASY)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  cardDifficulty === CardDifficulty.EASY
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Easy
              </button>
              <button
                onClick={() => handleCardDifficultyChange(CardDifficulty.MEDIUM)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  cardDifficulty === CardDifficulty.MEDIUM
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => handleCardDifficultyChange(CardDifficulty.HARD)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  cardDifficulty === CardDifficulty.HARD
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Hard
              </button>
            </div>
          </div>
        )}

        {/* Game Settings (Host Only) - Game Duration */}
        {isHost && (
          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 mb-2">Game Duration</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleGameDurationChange(GameDuration.SHORT)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  gameDuration === GameDuration.SHORT
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Short
              </button>
              <button
                onClick={() => handleGameDurationChange(GameDuration.MEDIUM)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  gameDuration === GameDuration.MEDIUM
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => handleGameDurationChange(GameDuration.LONG)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  gameDuration === GameDuration.LONG
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Long
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">
              {gameDuration === GameDuration.SHORT ? '10 cards' :
               gameDuration === GameDuration.MEDIUM ? '25 cards' : '50 cards'}
            </p>
          </div>
        )}

        {/* Non-host sees config summary */}
        {!isHost && roomState?.config && (
          <div className="mb-6 p-3 bg-gray-50 rounded-xl space-y-1">
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Card Layout:</span> {
                roomState.config.cardDifficulty === CardDifficulty.EASY ? 'Easy' :
                roomState.config.cardDifficulty === CardDifficulty.MEDIUM ? 'Medium' : 'Hard'
              }
            </p>
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Game Duration:</span> {
                roomState.config.gameDuration === GameDuration.SHORT ? 'Short (10 cards)' :
                roomState.config.gameDuration === GameDuration.MEDIUM ? 'Medium (25 cards)' : 'Long (50 cards)'
              }
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isHost && canStart ? (
            <button
              onClick={handleStartGame}
              className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 rounded-2xl text-xl font-black flex items-center justify-center gap-2 transition-all"
            >
              <Play size={24} />
              Start Now
            </button>
          ) : !isHost ? (
            <div className="text-center py-4 bg-gray-100 rounded-2xl text-gray-500 font-semibold">
              Waiting for players to join...
            </div>
          ) : null}

          <button
            onClick={handleLeave}
            className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
          >
            <LogOut size={20} /> Leave Room
          </button>
        </div>
        </div>
      </div>
    </>
  );
};

export default WaitingRoom;
