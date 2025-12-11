import React, { useState } from 'react';
import { Difficulty, GameConfig, CardDifficulty } from '../types';
import { unlockAudio } from '../utils/sound';

interface LobbyProps {
  onStart: (config: GameConfig) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [botCount, setBotCount] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [cardDifficulty, setCardDifficulty] = useState<CardDifficulty>(CardDifficulty.EASY);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Unlock audio on iOS - must happen in direct response to user gesture
    unlockAudio();
    onStart({
      playerName: name.trim() || 'Player 1',
      botCount,
      difficulty,
      cardDifficulty
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center p-4">
      
      {/* Header Section - Always at top, centered */}
      <div className="text-center text-white mb-6 md:mb-8 shrink-0">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight drop-shadow-md">
          SameSnap
        </h1>
        <p className="text-lg text-indigo-100 font-medium opacity-90">
          Spot the match. Be the fastest.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-2xl border-b-8 border-indigo-200">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Split Container: Stacks on portrait, Side-by-side on landscape/tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            
            {/* LEFT COLUMN: Identity & Opponents */}
            <div className="space-y-5">
              
              {/* Name */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors font-bold text-gray-800 placeholder-gray-400"
                  placeholder="Player 1"
                />
              </div>

              {/* Opponents */}
              <div>
                 <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">Opponents</label>
                 <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl">
                  {[1, 2, 3, 4, 5].map(num => (
                      <button
                      key={num}
                      type="button"
                      onClick={() => setBotCount(num)}
                      className={`flex-1 h-9 rounded-lg font-bold text-sm transition-all ${
                          botCount === num 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                      }`}
                      >
                      {num}
                      </button>
                  ))}
                  </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Settings */}
            <div className="space-y-5">
              
              {/* Speed */}
              <div>
                 <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">Opponent Speed</label>
                 <div className="grid grid-cols-3 gap-2">
                  {(Object.values(Difficulty) as Difficulty[]).map((diff) => (
                      <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                          difficulty === diff
                          ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      >
                      {diff}
                      </button>
                  ))}
                  </div>
              </div>

              {/* Layout */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">Card Layout</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                      type="button"
                      onClick={() => setCardDifficulty(CardDifficulty.EASY)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                      cardDifficulty === CardDifficulty.EASY
                          ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                      EASY
                  </button>
                  <button
                      type="button"
                      onClick={() => setCardDifficulty(CardDifficulty.MEDIUM)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                      cardDifficulty === CardDifficulty.MEDIUM
                          ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                      MEDIUM
                  </button>
                  <button
                      type="button"
                      onClick={() => setCardDifficulty(CardDifficulty.HARD)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                      cardDifficulty === CardDifficulty.HARD
                          ? 'bg-red-500 text-white shadow-md ring-2 ring-red-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                      HARD
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Footer: Play Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              className="w-full sm:w-auto sm:px-16 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 rounded-2xl text-xl font-black shadow-lg hover:shadow-xl transform active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              PLAY NOW
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Lobby;