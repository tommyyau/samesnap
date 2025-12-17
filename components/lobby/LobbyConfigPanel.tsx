import React from 'react';
import { CardLayout, GameDuration } from '../../shared/types';

export interface CardSetOption {
  id: string;
  name: string;
  symbols: { char: string }[];
  isBuiltIn: boolean;
}

interface LobbyConfigPanelProps {
  isHost: boolean;
  cardLayout: CardLayout;
  cardSetId: string;
  gameDuration: GameDuration;
  cardSets: CardSetOption[];
  onCardLayoutChange: (layout: CardLayout) => void;
  onCardSetChange: (cardSetId: string) => void;
  onGameDurationChange: (duration: GameDuration) => void;
  // For non-host view
  customSetName?: string;
  customSymbols?: string[];
}

export const LobbyConfigPanel: React.FC<LobbyConfigPanelProps> = ({
  isHost,
  cardLayout,
  cardSetId,
  gameDuration,
  cardSets,
  onCardLayoutChange,
  onCardSetChange,
  onGameDurationChange,
  customSetName,
  customSymbols,
}) => {
  const getCardSetById = (id: string) => cardSets.find((set) => set.id === id);

  if (isHost) {
    return (
      <>
        {/* Card Layout */}
        <div className="mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">Card Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onCardLayoutChange(CardLayout.ORDERLY)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                cardLayout === CardLayout.ORDERLY
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Orderly
            </button>
            <button
              onClick={() => onCardLayoutChange(CardLayout.CHAOTIC)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                cardLayout === CardLayout.CHAOTIC
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Chaotic
            </button>
          </div>
        </div>

        {/* Card Set */}
        <div className="mb-4">
          <p className="text-sm font-bold text-gray-700 mb-2">Card Set</p>
          <div className="grid grid-cols-3 gap-2">
            {cardSets.map((cardSet) => (
              <button
                key={cardSet.id}
                onClick={() => onCardSetChange(cardSet.id)}
                className={`py-2 rounded-xl text-sm font-bold transition-all relative ${
                  cardSetId === cardSet.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <div>{cardSet.name}</div>
                <div className="text-base mt-1">
                  {cardSet.symbols
                    .slice(0, 3)
                    .map((s) => s.char)
                    .join('')}
                </div>
                {!cardSet.isBuiltIn && (
                  <span className="absolute top-1 right-1 text-[8px] bg-green-500 text-white px-1 rounded">
                    Custom
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Game Duration */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-700 mb-2">Game Duration</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onGameDurationChange(GameDuration.SHORT)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                gameDuration === GameDuration.SHORT
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Short
            </button>
            <button
              onClick={() => onGameDurationChange(GameDuration.MEDIUM)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                gameDuration === GameDuration.MEDIUM
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => onGameDurationChange(GameDuration.LONG)}
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
            {gameDuration === GameDuration.SHORT
              ? '10 cards'
              : gameDuration === GameDuration.MEDIUM
                ? '25 cards'
                : '50 cards'}
          </p>
        </div>
      </>
    );
  }

  // Non-host: read-only config summary
  const selectedSet = getCardSetById(cardSetId);
  const displayName = customSetName ?? selectedSet?.name ?? 'Unknown';
  const previewSymbols =
    customSymbols?.slice(0, 3).join('') ??
    selectedSet?.symbols
      .slice(0, 3)
      .map((s) => s.char)
      .join('') ??
    '';

  return (
    <div className="mb-6 p-3 bg-gray-50 rounded-xl space-y-1">
      <p className="text-sm text-gray-500">
        <span className="font-semibold">Card Layout:</span>{' '}
        {cardLayout === CardLayout.ORDERLY ? 'Orderly' : 'Chaotic'}
      </p>
      <p className="text-sm text-gray-500">
        <span className="font-semibold">Card Set:</span> {displayName} {previewSymbols}
      </p>
      <p className="text-sm text-gray-500">
        <span className="font-semibold">Game Duration:</span>{' '}
        {gameDuration === GameDuration.SHORT
          ? 'Short (10 cards)'
          : gameDuration === GameDuration.MEDIUM
            ? 'Medium (25 cards)'
            : 'Long (50 cards)'}
      </p>
    </div>
  );
};

export default LobbyConfigPanel;
