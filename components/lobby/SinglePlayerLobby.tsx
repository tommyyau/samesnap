import React, { useState, useEffect } from 'react';
import { Difficulty, GameConfig, CardLayout, GameDuration, CardSet } from '../../shared/types';
import { getAllCardSets, DEFAULT_CARD_SET_ID } from '../../shared/cardSets';
import { unlockAudio, startBackgroundMusic } from '../../utils/sound';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useCustomCardSets } from '../../hooks/useCustomCardSets';

interface SinglePlayerLobbyProps {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
  onCreateCardSet?: () => void;
  onEditCardSet?: (cardSet: CardSet) => void;
}

const SinglePlayerLobby: React.FC<SinglePlayerLobbyProps> = ({
  onStart,
  onBack,
  onCreateCardSet,
  onEditCardSet,
}) => {
  const { user, isSignedIn } = useUser();
  const [name, setName] = useState('');
  const { customSets, deleteSet, refresh: refreshCustomSets } = useCustomCardSets();

  // Get all card sets (built-in + custom)
  const allCardSets = getAllCardSets();

  // Pre-fill player name from Clerk user's first name
  useEffect(() => {
    if (isSignedIn && user && user.firstName) {
      setName(user.firstName);
    }
  }, [isSignedIn, user]);

  // Refresh custom sets when component mounts (in case they were edited externally)
  useEffect(() => {
    refreshCustomSets();
  }, [refreshCustomSets]);

  const [botCount, setBotCount] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [cardLayout, setCardLayout] = useState<CardLayout>(CardLayout.ORDERLY);
  const [cardSetId, setCardSetId] = useState<string>(DEFAULT_CARD_SET_ID);
  const [gameDuration, setGameDuration] = useState<GameDuration>(GameDuration.SHORT);

  // Handle deleting a custom card set
  const handleDeleteCardSet = (setId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this card set?')) {
      deleteSet(setId);
      // If the deleted set was selected, switch to default
      if (cardSetId === setId) {
        setCardSetId(DEFAULT_CARD_SET_ID);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Unlock audio on iOS - must happen in direct response to user gesture
    // IMPORTANT: Both unlock AND startBackgroundMusic must be in the same gesture
    // for iOS to allow audio playback
    unlockAudio();
    startBackgroundMusic();
    onStart({
      playerName: name.trim() || 'Player 1',
      botCount,
      difficulty,
      cardLayout,
      cardSetId,
      gameDuration
    });
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center p-4">

        {/* Header Section */}
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
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
          >
            <ArrowLeft size={20} /> Back to Menu
          </button>

          <p className="text-gray-500 mb-6 font-medium text-center">Play Solo vs Bots</p>

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

                {/* Card Layout */}
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">Card Layout</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setCardLayout(CardLayout.ORDERLY)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                        cardLayout === CardLayout.ORDERLY
                            ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                    >
                        ORDERLY
                    </button>
                    <button
                        type="button"
                        onClick={() => setCardLayout(CardLayout.CHAOTIC)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                        cardLayout === CardLayout.CHAOTIC
                            ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                    >
                        CHAOTIC
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Set - Full Width Below */}
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">Card Set</label>
                <div className="grid grid-cols-3 gap-2">
                  {allCardSets.map(cardSet => (
                    <button
                      key={cardSet.id}
                      type="button"
                      onClick={() => setCardSetId(cardSet.id)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center relative group ${
                        cardSetId === cardSet.id
                          ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <div>{cardSet.name}</div>
                      <div className="text-lg mt-1">
                        {cardSet.symbols.slice(0, 3).map(s => s.char).join('')}
                      </div>
                      {/* Edit/Delete buttons for custom sets */}
                      {!cardSet.isBuiltIn && onEditCardSet && (
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCardSet(cardSet);
                            }}
                            className="p-1 bg-white/90 hover:bg-white rounded text-gray-600 hover:text-indigo-600"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCardSet(cardSet.id, e)}
                            className="p-1 bg-white/90 hover:bg-white rounded text-gray-600 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </button>
                  ))}
                  {/* Create New Card Set Button */}
                  {onCreateCardSet && (
                    <button
                      type="button"
                      onClick={onCreateCardSet}
                      className="py-2 px-1 rounded-lg text-xs font-bold transition-all text-center bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600 border-2 border-dashed border-gray-300 hover:border-indigo-400 flex flex-col items-center justify-center"
                    >
                      <Plus size={20} className="mb-1" />
                      <div>Create New</div>
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Game Duration - Full Width */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">Game Duration</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setGameDuration(GameDuration.SHORT)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                    gameDuration === GameDuration.SHORT
                      ? 'bg-green-500 text-white shadow-md ring-2 ring-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  SHORT (10)
                </button>
                <button
                  type="button"
                  onClick={() => setGameDuration(GameDuration.MEDIUM)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                    gameDuration === GameDuration.MEDIUM
                      ? 'bg-yellow-500 text-white shadow-md ring-2 ring-yellow-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  MEDIUM (25)
                </button>
                <button
                  type="button"
                  onClick={() => setGameDuration(GameDuration.LONG)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                    gameDuration === GameDuration.LONG
                      ? 'bg-red-500 text-white shadow-md ring-2 ring-red-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  LONG (50)
                </button>
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

        <div className="mt-8 text-white/80 text-center max-w-lg text-sm">
          <p>Match the common symbol between the Snap Card and your card to win!</p>
        </div>
      </div>
  );
};

export default SinglePlayerLobby;
