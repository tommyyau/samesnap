import React, { useEffect, useState } from 'react';
import { X, Loader2, Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import type { CardSet } from '../../shared/types';
import { ConfirmModal } from '../common/ConfirmModal';

interface CardSetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCardSet: () => void;
  onEditCardSet: (cardSet: CardSet) => void;
  onDeleteCardSet: (id: string) => Promise<boolean>;
  cardSets: CardSet[];
  isLoading: boolean;
  canCreate: boolean;
}

interface CardSetCardProps {
  cardSet: CardSet;
  onEdit: () => void;
  onDelete: () => void;
}

const CardSetCard: React.FC<CardSetCardProps> = ({ cardSet, onEdit, onDelete }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 group relative">
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-semibold text-gray-800">{cardSet.name}</h3>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 bg-gray-100 hover:bg-indigo-100 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 bg-gray-100 hover:bg-red-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
    <div className="flex flex-wrap gap-1 text-lg leading-none">
      {cardSet.symbols.slice(0, 57).map((symbol, idx) =>
        symbol.imageUrl ? (
          <img
            key={idx}
            src={symbol.imageUrl}
            alt={symbol.name}
            title={symbol.name}
            className="w-5 h-5 object-contain"
          />
        ) : (
          <span key={idx} title={symbol.name}>
            {symbol.char}
          </span>
        )
      )}
    </div>
  </div>
);

const CardSetsDrawer: React.FC<CardSetsDrawerProps> = ({
  isOpen,
  onClose,
  onCreateCardSet,
  onEditCardSet,
  onDeleteCardSet,
  cardSets,
  isLoading,
  canCreate,
}) => {
  const { user } = useUser();
  const [deleteTarget, setDeleteTarget] = useState<CardSet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const success = await onDeleteCardSet(deleteTarget.id);
      if (success) {
        setDeleteTarget(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (cardSet: CardSet) => {
    onClose();
    onEditCardSet(cardSet);
  };

  const handleCreateClick = () => {
    onClose();
    onCreateCardSet();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-gradient-to-b from-indigo-50 to-white shadow-xl z-50
          transform transition-transform duration-300 ease-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-indigo-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={20} />
              <h2 className="text-lg font-bold">My Card Sets</h2>
              {isLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 mt-3">
              <img
                src={user.imageUrl}
                alt={user.fullName || 'User'}
                className="w-12 h-12 rounded-full border-2 border-white/30"
              />
              <div className="overflow-hidden">
                <div className="font-medium truncate">
                  {user.fullName || user.firstName || 'Player'}
                </div>
                <div className="text-sm text-indigo-200 truncate">
                  {user.primaryEmailAddress?.emailAddress}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-180px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : cardSets.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No custom card sets yet!</p>
              <p className="text-sm mt-1">Create your own set with custom emojis.</p>
            </div>
          ) : (
            <>
              {cardSets.map((cardSet) => (
                <CardSetCard
                  key={cardSet.id}
                  cardSet={cardSet}
                  onEdit={() => handleEditClick(cardSet)}
                  onDelete={() => setDeleteTarget(cardSet)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="text-center text-sm text-gray-500 mb-3">
            {cardSets.length}/10 slots used
          </div>
          {canCreate && (
            <button
              onClick={handleCreateClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
            >
              <Plus size={18} />
              Create Card Set
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Card Set"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};

export default CardSetsDrawer;
