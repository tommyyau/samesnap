import React, { useEffect } from 'react';
import { X, Loader2, Trophy, Target, Zap, Clock } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useUserStats } from '../../hooks/useUserStats';
import type { ModeStats } from '../../shared/types';
import StatRow from './StatRow';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Format milliseconds to human readable time
function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// Format timestamp to relative time
function formatLastActive(timestamp: number): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(timestamp).toLocaleDateString();
}

// Calculate win rate percentage
function winRate(stats: ModeStats): string {
  if (stats.gamesPlayed === 0) return '0%';
  return `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%`;
}

interface StatsSectionProps {
  title: string;
  icon: React.ReactNode;
  stats: ModeStats;
}

const StatsSection: React.FC<StatsSectionProps> = ({ title, icon, stats }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
      {icon}
      <h3 className="font-semibold text-gray-800">{title}</h3>
    </div>
    <div className="space-y-0">
      <StatRow label="Games Played" value={stats.gamesPlayed} />
      <StatRow label="Wins" value={stats.wins} highlight />
      <StatRow label="Losses" value={stats.losses} />
      <StatRow label="Win Rate" value={winRate(stats)} highlight />
      <StatRow label="Current Streak" value={`${stats.currentStreak} win${stats.currentStreak === 1 ? '' : 's'}`} />
      <StatRow label="Best Streak" value={`${stats.longestStreak} win${stats.longestStreak === 1 ? '' : 's'}`} highlight />
      <StatRow label="Fastest Win" value={formatDuration(stats.fastestWinMs)} />
    </div>
  </div>
);

const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useUser();
  const { stats, isLoading, error, refresh } = useUserStats();

  // Refresh stats when drawer opens
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

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
              <h2 className="text-lg font-bold">My Stats</h2>
              {isLoading && stats && (
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
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-120px)]">
          {/* Show spinner only if loading AND no cached stats */}
          {isLoading && !stats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : error && !stats ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">
              {error}
            </div>
          ) : stats ? (
            <>
              {/* Single Player Stats */}
              <StatsSection
                title="Single Player"
                icon={<Target className="w-5 h-5 text-indigo-600" />}
                stats={stats.singlePlayer}
              />

              {/* Multiplayer Stats */}
              <StatsSection
                title="Multiplayer"
                icon={<Trophy className="w-5 h-5 text-amber-500" />}
                stats={stats.multiplayer}
              />

              {/* Last Activity */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Last Active:</span>
                  <span className="text-sm font-medium text-gray-800">
                    {formatLastActive(stats.lastActivityAt)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No stats yet!</p>
              <p className="text-sm mt-1">Play some games to see your stats here.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProfileDrawer;
