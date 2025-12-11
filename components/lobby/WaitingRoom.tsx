import React, { useState, useEffect } from 'react';
import { Copy, Check, Crown, Wifi, WifiOff, Play, LogOut } from 'lucide-react';
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

  const { roomState, isConnected, isHost, latency, startGame, leaveRoom } = useMultiplayerGame({
    roomCode,
    playerName,
    onError: (err) => console.error(err),
    onKicked: onLeave,
  });

  // Redirect to game when it starts
  useEffect(() => {
    if (roomState?.phase === RoomPhase.PLAYING || roomState?.phase === RoomPhase.COUNTDOWN) {
      onGameStart();
    }
  }, [roomState?.phase, onGameStart]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    startGame({ cardDifficulty, maxPlayers: 8 });
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  const canStart = isHost && (roomState?.players.length || 0) >= 2;

  return (
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

        {/* Players List */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-700 mb-2">
            Players ({roomState?.players.length || 0}/8)
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
              {canStart ? 'Start Game' : 'Need 2+ Players'}
            </button>
          ) : (
            <div className="text-center py-4 bg-gray-100 rounded-2xl text-gray-500 font-semibold">
              Waiting for host to start...
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
