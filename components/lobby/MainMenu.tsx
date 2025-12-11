import React, { useState } from 'react';
import { Users, User, ArrowRight } from 'lucide-react';

interface MainMenuProps {
  onSinglePlayer: () => void;
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSinglePlayer, onCreateRoom, onJoinRoom }) => {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    if (playerName.trim()) {
      onCreateRoom(playerName.trim());
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && roomCode.trim().length === 4) {
      onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    }
  };

  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
            SameSnap
          </h1>
          <p className="text-gray-500 mb-8">Spot the match. Be the fastest.</p>

          <div className="space-y-4">
            <button
              onClick={onSinglePlayer}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all"
            >
              <User size={24} /> Play Solo vs Bots
            </button>

            <button
              onClick={() => setMode('create')}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all"
            >
              <Users size={24} /> Create Multiplayer Room
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all"
            >
              <ArrowRight size={24} /> Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
        <button onClick={() => setMode('menu')} className="text-gray-500 mb-4">&larr; Back</button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {mode === 'create' ? 'Create Room' : 'Join Room'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none font-semibold"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          {mode === 'join' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none font-semibold text-center text-2xl tracking-widest"
                placeholder="ABCD"
                maxLength={4}
              />
            </div>
          )}

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={!playerName.trim() || (mode === 'join' && roomCode.length !== 4)}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-300 text-yellow-900 disabled:text-gray-500 rounded-2xl text-xl font-black transition-all"
          >
            {mode === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
