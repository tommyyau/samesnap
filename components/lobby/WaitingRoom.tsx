import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, Wifi, WifiOff, Play, LogOut, Users, Clock } from 'lucide-react';
import { CardLayout, GameDuration, RoomPhase, SymbolItem } from '../../shared/types';
import { getBuiltInCardSets, getSymbolsForCardSet, DEFAULT_CARD_SET_ID } from '../../shared/cardSets';
import { useCustomCardSets } from '../../hooks/useCustomCardSets';
import { useRoomCountdown } from '../../hooks/useRoomCountdown';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import type { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { unlockAudio, startBackgroundMusic } from '../../utils/sound';
import { ConnectionErrorModal } from '../common/ConnectionErrorModal';
import { LobbyPlayerList, LobbyPlayer } from './LobbyPlayerList';
import { LobbyConfigPanel, CardSetOption } from './LobbyConfigPanel';

interface WaitingRoomProps {
  roomCode: string;
  playerName: string;
  onLeave: () => void;
  multiplayerHook: ReturnType<typeof useMultiplayerGame>;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomCode, onLeave, multiplayerHook }) => {
  const [copied, setCopied] = useState(false);
  // Local state for host controls - always synced from server config when it changes
  const [cardLayout, setCardLayout] = useState<CardLayout>(CardLayout.ORDERLY);
  const [cardSetId, setCardSetId] = useState<string>(DEFAULT_CARD_SET_ID);
  const [gameDuration, setGameDuration] = useState<GameDuration>(GameDuration.MEDIUM);

  const { roomState, isConnected, isHost, latency, connectionError, setConfig, startGame, leaveRoom, clearError } = multiplayerHook;

  // Get card sets (built-in + custom from cloud)
  const { customSets } = useCustomCardSets();
  const builtInSets = getBuiltInCardSets();
  const allCardSets: CardSetOption[] = useMemo(
    () => [...builtInSets, ...customSets],
    [builtInSets, customSets]
  );

  // Helper to get a card set by ID
  const getCardSetById = (id: string) => allCardSets.find((set) => set.id === id);

  // Preload PNG images for selected card set (runs in background during lobby)
  // This ensures images are cached before game starts
  const preloadSymbols = useMemo((): SymbolItem[] => {
    const selectedSet = getCardSetById(cardSetId);
    if (selectedSet && !selectedSet.isBuiltIn) {
      // Custom set - use custom symbols (emoji-only, no preload needed)
      return [];
    }
    // Built-in set - get symbols which may include PNG imageUrls
    return getSymbolsForCardSet(cardSetId);
  }, [cardSetId, allCardSets]);

  // Start preloading as soon as card set is selected (fire-and-forget)
  useImagePreloader(preloadSymbols);

  // Room timeout countdown (clock-skew safe)
  const timeLeft = useRoomCountdown(roomState?.roomExpiresInMs);

  // Always sync local state FROM server config when it changes
  useEffect(() => {
    if (roomState?.config) {
      setCardLayout(roomState.config.cardLayout);
      setCardSetId(roomState.config.cardSetId);
      setGameDuration(roomState.config.gameDuration);
    }
  }, [roomState?.config?.cardLayout, roomState?.config?.cardSetId, roomState?.config?.gameDuration]);

  // Helper to build config with custom symbols if needed
  const buildConfig = (overrides: Partial<{ cardLayout: CardLayout; cardSetId: string; gameDuration: GameDuration }>) => {
    const finalCardSetId = overrides.cardSetId ?? cardSetId;
    const selectedSet = getCardSetById(finalCardSetId);
    const isCustomSet = selectedSet && !selectedSet.isBuiltIn;

    return {
      cardLayout: overrides.cardLayout ?? cardLayout,
      cardSetId: finalCardSetId,
      gameDuration: overrides.gameDuration ?? gameDuration,
      // Include custom symbols if using a custom set
      ...(isCustomSet && selectedSet
        ? {
            customSymbols: selectedSet.symbols.map((s) => s.char),
            customSetName: selectedSet.name,
          }
        : {}),
    };
  };

  // Handler for when host explicitly changes card layout
  const handleCardLayoutChange = (newLayout: CardLayout) => {
    setCardLayout(newLayout);
    if (isHost && roomState?.phase === RoomPhase.WAITING) {
      setConfig(buildConfig({ cardLayout: newLayout }));
    }
  };

  // Handler for when host explicitly changes card set
  const handleCardSetChange = (newCardSetId: string) => {
    setCardSetId(newCardSetId);
    if (isHost && roomState?.phase === RoomPhase.WAITING) {
      setConfig(buildConfig({ cardSetId: newCardSetId }));
    }
  };

  // Handler for when host explicitly changes game duration
  const handleGameDurationChange = (newDuration: GameDuration) => {
    setGameDuration(newDuration);
    if (isHost && roomState?.phase === RoomPhase.WAITING) {
      setConfig(buildConfig({ gameDuration: newDuration }));
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    // Unlock audio on iOS/Safari - must happen during user gesture
    unlockAudio();
    startBackgroundMusic();
    startGame(buildConfig({}));
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  const handleErrorRetry = () => {
    clearError();
  };

  const handleErrorLeave = () => {
    clearError();
    onLeave();
  };

  const currentPlayers = roomState?.players.length || 0;
  const canStart = isHost && currentPlayers >= 2;

  // Convert players to LobbyPlayer format
  const lobbyPlayers: LobbyPlayer[] = useMemo(
    () =>
      roomState?.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isYou: p.isYou,
        status: p.status,
      })) || [],
    [roomState?.players]
  );

  return (
    <>
      {/* Connection Error Modal */}
      {connectionError && (
        <ConnectionErrorModal
          error={connectionError}
          onRetry={handleErrorRetry}
          onLeave={handleErrorLeave}
        />
      )}

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
          <div className="text-center mb-4">
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

          {/* Prominent Countdown Timer */}
          {timeLeft !== null && timeLeft > 0 && (
            <div className="text-center mb-4 p-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-2xl border-2 border-orange-300">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Clock size={32} className="text-orange-600 animate-pulse" />
                <span className="text-4xl font-black text-orange-600">{timeLeft}s</span>
              </div>
              <p className="text-sm text-orange-700 font-medium">Game starts when timer ends</p>
              <p className="text-xs text-orange-500 mt-1">
                {isHost ? 'Or click "Start Now" with 2+ players' : 'Host can start early with 2+ players'}
              </p>
            </div>
          )}

          {/* Status Messages */}
          {currentPlayers < 2 && (
            <div className="text-center mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-center justify-center gap-2 text-red-700 font-bold">
                <Users size={20} />
                Need at least 1 friend to play!
              </div>
              <p className="text-xs text-red-500 mt-1">Share the room code above</p>
            </div>
          )}

          {currentPlayers >= 2 && (
            <div className="text-center mb-4 p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                <Check size={20} />
                Ready to play! ({currentPlayers} player{currentPlayers !== 1 ? 's' : ''})
              </div>
            </div>
          )}

          {/* Players List */}
          <LobbyPlayerList players={lobbyPlayers} />

          {/* Game Settings */}
          <LobbyConfigPanel
            isHost={isHost}
            cardLayout={cardLayout}
            cardSetId={cardSetId}
            gameDuration={gameDuration}
            cardSets={allCardSets}
            onCardLayoutChange={handleCardLayoutChange}
            onCardSetChange={handleCardSetChange}
            onGameDurationChange={handleGameDurationChange}
            customSetName={roomState?.config?.customSetName}
            customSymbols={roomState?.config?.customSymbols}
          />

          {/* Actions */}
          <div className="space-y-3">
            {isHost && canStart ? (
              <button
                onClick={handleStartGame}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 rounded-2xl text-xl font-black flex items-center justify-center gap-2 transition-all"
              >
                <Play size={24} />
                Start Now
              </button>
            ) : !isHost ? (
              <div className="text-center py-4 bg-gray-100 rounded-2xl text-gray-500 font-semibold">
                Waiting for players to join...
              </div>
            ) : null}

            <button
              onClick={handleLeave}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <LogOut size={20} /> Leave Room
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WaitingRoom;
