import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { EMOJI_DATA, ALL_EMOJIS, EmojiItem } from '../../data/emojiData';

interface EmojiPickerProps {
  selectedEmojis: Set<string>;
  onToggleEmoji: (emoji: string) => void;
  maxSelection?: number;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  selectedEmojis,
  onToggleEmoji,
  maxSelection = 57,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('smileys');

  // Filter emojis based on search (now searches by name too!)
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      return EMOJI_DATA[activeCategory]?.emojis || [];
    }
    // When searching, search by name and emoji character across all categories
    const query = searchQuery.toLowerCase();
    return ALL_EMOJIS.filter(emoji =>
      emoji.name.toLowerCase().includes(query) ||
      emoji.char.includes(query)
    );
  }, [searchQuery, activeCategory]);

  const categoryKeys = Object.keys(EMOJI_DATA);

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis by name..."
          className="w-full pl-10 pr-10 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Category Tabs (hidden when searching) */}
      {!searchQuery && (
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-hide">
          {categoryKeys.map((key) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {EMOJI_DATA[key].name}
            </button>
          ))}
        </div>
      )}

      {/* Selection Counter */}
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="text-gray-500">
          {searchQuery ? `Search results (${filteredEmojis.length})` : EMOJI_DATA[activeCategory]?.name}
        </span>
        <span className={`font-bold ${selectedEmojis.size === maxSelection ? 'text-green-600' : 'text-indigo-600'}`}>
          {selectedEmojis.size}/{maxSelection} selected
        </span>
      </div>

      {/* Emoji Grid */}
      <div className="flex-1 overflow-y-auto border rounded-xl p-2 bg-gray-50 min-h-[200px]">
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
          {filteredEmojis.map((emoji: EmojiItem, index: number) => {
            const isSelected = selectedEmojis.has(emoji.char);
            const isDisabled = !isSelected && selectedEmojis.size >= maxSelection;

            return (
              <button
                key={`${emoji.char}-${index}`}
                onClick={() => !isDisabled && onToggleEmoji(emoji.char)}
                disabled={isDisabled}
                className={`
                  w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center text-2xl sm:text-xl rounded-lg transition-all
                  ${isSelected
                    ? 'bg-indigo-500 ring-2 ring-indigo-300 scale-110'
                    : isDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-gray-200 active:scale-95'
                  }
                `}
                title={emoji.name}
              >
                {emoji.char}
              </button>
            );
          })}
        </div>
        {filteredEmojis.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400">
            No emojis found for "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
