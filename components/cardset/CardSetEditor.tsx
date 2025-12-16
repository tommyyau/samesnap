import React, { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Save, Trash2, ClipboardPaste, Shuffle, X } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import { CardSet } from '../../shared/types';

interface CardSetEditorProps {
  /** Existing card set to edit, or undefined for creating new */
  existingSet?: CardSet;
  /** Called when user saves the card set */
  onSave: (name: string, symbols: string[]) => void;
  /** Called when user cancels or goes back */
  onCancel: () => void;
  /** Called when user deletes the set (only for existing sets) */
  onDelete?: () => void;
}

const REQUIRED_SYMBOLS = 57;

const CardSetEditor: React.FC<CardSetEditorProps> = ({
  existingSet,
  onSave,
  onCancel,
  onDelete,
}) => {
  const [name, setName] = useState(existingSet?.name || '');
  const [selectedEmojis, setSelectedEmojis] = useState<Set<string>>(() => {
    if (existingSet) {
      return new Set(existingSet.symbols.map(s => s.char));
    }
    return new Set();
  });
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');

  const isEditing = !!existingSet;
  const symbolsArray = useMemo(() => Array.from(selectedEmojis), [selectedEmojis]);
  const isValid = name.trim().length > 0 && selectedEmojis.size === REQUIRED_SYMBOLS;

  // Toggle emoji selection
  const handleToggleEmoji = useCallback((emoji: string) => {
    setSelectedEmojis(prev => {
      const next = new Set(prev);
      if (next.has(emoji)) {
        next.delete(emoji);
      } else if (next.size < REQUIRED_SYMBOLS) {
        next.add(emoji);
      }
      return next;
    });
  }, []);

  // Remove emoji from selection (used in preview)
  const handleRemoveEmoji = useCallback((emoji: string) => {
    setSelectedEmojis(prev => {
      const next = new Set(prev);
      next.delete(emoji);
      return next;
    });
  }, []);

  // Clear all selected emojis
  const handleClearAll = useCallback(() => {
    setSelectedEmojis(new Set());
  }, []);

  // Shuffle order (visual only, for preview)
  const handleShuffle = useCallback(() => {
    setSelectedEmojis(prev => {
      const arr = Array.from(prev);
      // Fisher-Yates shuffle
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return new Set(arr);
    });
  }, []);

  // Parse pasted emojis
  const handlePasteSubmit = useCallback(() => {
    setPasteError('');

    // Extract emojis from pasted text using emoji regex
    // This regex matches most emojis including compound ones
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
    const matches = pasteText.match(emojiRegex);

    if (!matches || matches.length === 0) {
      setPasteError('No emojis found in the pasted text');
      return;
    }

    // Get unique emojis
    const uniqueEmojis = [...new Set(matches)];

    if (uniqueEmojis.length < REQUIRED_SYMBOLS) {
      setPasteError(`Found ${uniqueEmojis.length} unique emojis, need exactly ${REQUIRED_SYMBOLS}`);
      return;
    }

    if (uniqueEmojis.length > REQUIRED_SYMBOLS) {
      setPasteError(`Found ${uniqueEmojis.length} unique emojis, need exactly ${REQUIRED_SYMBOLS}. Using first ${REQUIRED_SYMBOLS}.`);
      // Still proceed with first 57
    }

    setSelectedEmojis(new Set(uniqueEmojis.slice(0, REQUIRED_SYMBOLS)));
    setShowPasteModal(false);
    setPasteText('');
  }, [pasteText]);

  // Save handler
  const handleSave = useCallback(() => {
    if (!isValid) return;
    onSave(name.trim(), symbolsArray);
  }, [name, symbolsArray, isValid, onSave]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-xl font-bold text-white">
            {isEditing ? 'Edit Card Set' : 'Create Card Set'}
          </h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col gap-4">
        {/* Name Input */}
        <div className="bg-white rounded-2xl p-4 shadow-lg">
          <label className="block text-xs uppercase tracking-wider font-bold text-gray-400 mb-1">
            Card Set Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Set"
            className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none font-bold text-gray-800"
            maxLength={50}
          />
        </div>

        {/* Two Column Layout: Picker + Preview */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
          {/* Emoji Picker */}
          <div className="bg-white rounded-2xl p-4 shadow-lg flex flex-col min-h-[300px] sm:min-h-[400px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-700">Select Emojis</h2>
              <button
                onClick={() => setShowPasteModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <ClipboardPaste size={14} />
                Paste 57
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <EmojiPicker
                selectedEmojis={selectedEmojis}
                onToggleEmoji={handleToggleEmoji}
                maxSelection={REQUIRED_SYMBOLS}
              />
            </div>
          </div>

          {/* Selected Emojis Panel - The 57-Slot Grid */}
          <div className="bg-white rounded-2xl p-4 shadow-lg flex flex-col min-h-[250px] sm:min-h-[400px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-700">Your 57 Emojis</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  selectedEmojis.size === REQUIRED_SYMBOLS
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {selectedEmojis.size}/{REQUIRED_SYMBOLS}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleShuffle}
                  disabled={selectedEmojis.size === 0}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Shuffle order"
                >
                  <Shuffle size={14} />
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={selectedEmojis.size === 0}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Clear all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* 57-Slot Grid - Always shows all 57 positions */}
            <div className="flex-1 overflow-y-auto border-2 border-dashed border-gray-300 rounded-xl p-2 bg-gradient-to-br from-gray-50 to-gray-100">
              <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-8 gap-1">
                {Array.from({ length: REQUIRED_SYMBOLS }).map((_, index) => {
                  const emoji = symbolsArray[index];
                  const isFilled = !!emoji;

                  return (
                    <div
                      key={index}
                      className={`
                        aspect-square flex items-center justify-center rounded-lg text-lg sm:text-xl transition-all
                        ${isFilled
                          ? 'bg-white border-2 border-indigo-200 shadow-sm cursor-pointer hover:bg-red-50 hover:border-red-300 group relative'
                          : 'bg-gray-200/50 border-2 border-dashed border-gray-300'
                        }
                      `}
                      onClick={() => isFilled && handleRemoveEmoji(emoji)}
                      title={isFilled ? `${emoji} - Click to remove` : `Slot ${index + 1} - Empty`}
                    >
                      {isFilled ? (
                        <>
                          {emoji}
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                            <X size={10} />
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-300 text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    selectedEmojis.size === REQUIRED_SYMBOLS
                      ? 'bg-green-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${(selectedEmojis.size / REQUIRED_SYMBOLS) * 100}%` }}
                />
              </div>
              <p className={`mt-1 text-xs font-medium text-center ${
                selectedEmojis.size === REQUIRED_SYMBOLS
                  ? 'text-green-600'
                  : 'text-gray-500'
              }`}>
                {selectedEmojis.size === REQUIRED_SYMBOLS
                  ? '✓ Complete! Ready to save.'
                  : selectedEmojis.size === 0
                    ? 'Select emojis from the picker or paste 57 emojis'
                    : `${REQUIRED_SYMBOLS - selectedEmojis.size} more to go`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-2xl p-4 shadow-lg flex items-center justify-between">
          {isEditing && onDelete ? (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 size={18} />
              Delete Set
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 text-white disabled:text-gray-500 rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <Save size={18} />
              {isEditing ? 'Save Changes' : 'Create Set'}
            </button>
          </div>
        </div>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Paste Emojis</h3>
            <p className="text-sm text-gray-500 mb-4">
              Paste exactly 57 emojis below. You can copy them from any source -
              we'll extract the unique emojis automatically.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                setPasteError('');
              }}
              placeholder="Paste 57 emojis here..."
              className="w-full h-32 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-2xl resize-none"
            />
            {pasteError && (
              <p className="mt-2 text-sm text-red-600">{pasteError}</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPasteText('');
                  setPasteError('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                disabled={!pasteText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-300 text-white rounded-xl font-medium"
              >
                Import Emojis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardSetEditor;
