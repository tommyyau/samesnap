import React, { useState } from 'react';
import { Difficulty, GameConfig, CardLayout, GameDuration } from '../types';
import { DEFAULT_CARD_SET_ID } from '../shared/cardSets';

interface LobbyProps {
  onStart: (config: GameConfig) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [botCount, setBotCount] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [cardLayout, setCardLayout] = useState<CardLayout>(CardLayout.ORDERLY);
  const [gameDuration, setGameDuration] = useState<GameDuration>(GameDuration.MEDIUM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({
      playerName: name.trim() || 'Player 1',
      botCount,
      difficulty,
      cardLayout,
      cardSetId: DEFAULT_CARD_SET_ID,
      gameDuration
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-b-8 border-indigo-200">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
          SameSnap
        </h1>
        <p className="text-gray-500 mb-8 font-medium">Spot the match. Be the fastest.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-left">
            <label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white focus:border-indigo-500 focus:outline-none transition-colors font-semibold text-lg text-gray-900 placeholder-gray-400"
              placeholder="Player 1"
            />
          </div>

          <div className="text-left">
            <label className="block text-sm font-bold text-gray-700 mb-1">Opponents (Bots)</label>
            <div className="flex justify-between items-center bg-gray-100 p-2 rounded-xl">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setBotCount(num)}
                  className={`w-10 h-10 rounded-lg font-bold transition-all ${
                    botCount === num 
                      ? 'bg-indigo-600 text-white shadow-lg scale-110' 
                      : 'text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="text-left">
            <label className="block text-sm font-bold text-gray-700 mb-1">Opponent Speed</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.values(Difficulty) as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    difficulty === diff
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <div className="text-left">
            <label className="block text-sm font-bold text-gray-700 mb-1">Card Layout</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCardLayout(CardLayout.ORDERLY)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  cardLayout === CardLayout.ORDERLY
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Orderly
              </button>
              <button
                type="button"
                onClick={() => setCardLayout(CardLayout.CHAOTIC)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  cardLayout === CardLayout.CHAOTIC
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Chaotic
              </button>
            </div>
          </div>

          <div className="text-left">
            <label className="block text-sm font-bold text-gray-700 mb-1">Game Duration</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGameDuration(GameDuration.SHORT)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  gameDuration === GameDuration.SHORT
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Short (10)
              </button>
              <button
                type="button"
                onClick={() => setGameDuration(GameDuration.MEDIUM)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  gameDuration === GameDuration.MEDIUM
                    ? 'bg-yellow-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Medium (25)
              </button>
              <button
                type="button"
                onClick={() => setGameDuration(GameDuration.LONG)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  gameDuration === GameDuration.LONG
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Long (50)
              </button>
            </div>
          </div>

          <div className="pt-4">
             <button
              type="submit"
              className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 rounded-2xl text-xl font-black shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
            >
              PLAY NOW
            </button>
          </div>
        </form>
      </div>
      
      <div className="mt-8 text-white/80 text-center max-w-lg text-sm">
        <p>Match the common symbol between the Snap Card and your card to win!</p>
        <p className="mt-2 text-xs opacity-60">Uses Order-7 Projective Plane mathematics for standard 57-card deck generation.</p>
      </div>
    </div>
  );
};

export default Lobby;