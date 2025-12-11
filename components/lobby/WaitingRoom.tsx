import React, { useState, useEffect } from 'react';
import { Copy, Check, Crown, Wifi, WifiOff, Play, LogOut, Users, Clock } from 'lucide-react';
import { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { CardDifficulty, RoomPhase } from '../../shared/types';

interface WaitingRoomProps {
  roomCode: string;
  playerName: string;
  onLeave: () => void;
  onGameStart: () => void;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomCode, playerName, onLeave, onGameStart }) => {
  const [copied, setCopied] = useState(false);
  const [cardDifficulty, setCardDifficulty] = useState<CardDifficulty>(CardDifficulty.EASY);
  const [targetPlayers, setTargetPlayers] = useState(2);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { roomState, isConnected, isHost, latency, setConfig, startGame, leaveRoom } = useMultiplayerGame({
    roomCode,
    playerName,
    onError: (err) => console.error(err),
    onKicked: onLeave,
    onRoomExpired: (reason) => {
      alert(reason);
      onLeave();
    },
  });

  // Send config when host changes settings
  useEffect(() => {
    if (isHost && roomState?.phase === RoomPhase.WAITING) {
      setConfig({ cardDifficulty, targetPlayers });
    }
  }, [isHost, cardDifficulty, targetPlayers, setConfig, roomState?.phase]);

  // Redirect to game when it starts
  useEffect(() => {
    if (roomState?.phase === RoomPhase.PLAYING || roomState?.phase === RoomPhase.COUNTDOWN) {
      onGameStart();
    }
  }, [roomState?.phase, onGameStart]);

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
    startGame({ cardDifficulty, targetPlayers });
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  const currentPlayers = roomState?.players.length || 0;
  const effectiveTarget = roomState?.targetPlayers || targetPlayers;
  const playersNeeded = Math.max(0, effectiveTarget - currentPlayers);
  const canStart = isHost && currentPlayers >= 2;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
        {/* Connection & Timer Status */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected ? `Connected (${latency}ms)` : 'Disconnected'}
          </div>
          {timeLeft !== null && timeLeft > 0 && (
            <div className="flex items-center gap-1 text-sm text-orange-600 font-bold">
              <Clock size={16} />
              {timeLeft}s
            </div>
          )}
        </div>

        {/* Room Code */}
        <div className="text-center mb-6">
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

        {/* Waiting Message */}
        {playersNeeded > 0 && (
          <div className="text-center mb-4 p-3 bg-indigo-50 rounded-xl">
            <div className="flex items-center justify-center gap-2 text-indigo-700 font-bold">
              <Users size={20} />
              Waiting for {playersNeeded} more player{playersNeeded !== 1 ? 's' : ''}...
            </div>
            <p className="text-xs text-indigo-500 mt-1">
              Game starts automatically when {effectiveTarget} player{effectiveTarget !== 1 ? 's join' : ' joins'}
            </p>
          </div>
        )}

        {playersNeeded === 0 && currentPlayers >= effectiveTarget && (
          <div className="text-center mb-4 p-3 bg-green-50 rounded-xl">
            <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
              <Check size={20} />
              All players joined! Starting soon...
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-700 mb-2">
            Players ({currentPlayers}/{effectiveTarget})
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

        {/* Game Settings (Host Only) */}
        {isHost && (
          <>
            {/* Target Players */}
            <div className="mb-4">
              <p className="text-sm font-bold text-gray-700 mb-2">Players to Start</p>
              <div className="flex justify-between items-center bg-gray-100 p-2 rounded-xl">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setTargetPlayers(num)}
                    className={`w-8 h-8 rounded-lg font-bold text-sm transition-all ${
                      targetPlayers === num
                        ? 'bg-indigo-600 text-white shadow-lg scale-110'
                        : 'text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Layout */}
            <div className="mb-6">
              <p className="text-sm font-bold text-gray-700 mb-2">Card Layout</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCardDifficulty(CardDifficulty.EASY)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    cardDifficulty === CardDifficulty.EASY
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Easy (Orderly)
                </button>
                <button
                  onClick={() => setCardDifficulty(CardDifficulty.MEDIUM)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    cardDifficulty === CardDifficulty.MEDIUM
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Medium (Chaotic)
                </button>
              </div>
            </div>
          </>
        )}

        {/* Non-host sees config summary */}
        {!isHost && roomState?.config && (
          <div className="mb-6 p-3 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Target:</span> {roomState.config.targetPlayers} players |{' '}
              <span className="font-semibold">Layout:</span> {roomState.config.cardDifficulty === CardDifficulty.EASY ? 'Easy' : 'Medium'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-300 text-yellow-900 disabled:text-gray-500 rounded-2xl text-xl font-black flex items-center justify-center gap-2 transition-all"
            >
              <Play size={24} />
              {canStart ? 'Start Now' : 'Need 2+ Players'}
            </button>
          ) : (
            <div className="text-center py-4 bg-gray-100 rounded-2xl text-gray-500 font-semibold">
              Waiting for players to join...
            </div>
          )}

          <button
            onClick={handleLeave}
            className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
          >
            <LogOut size={20} /> Leave Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
