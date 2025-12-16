import React, { useState, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/clerk-react';
import MainMenu from './components/lobby/MainMenu';
import SinglePlayerLobby from './components/lobby/SinglePlayerLobby';
import SinglePlayerGame from './components/game/SinglePlayerGame';
import WaitingRoom from './components/lobby/WaitingRoom';
import MultiplayerGame from './components/game/MultiplayerGame';
import CardSetEditor from './components/cardset/CardSetEditor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameConfig, RoomPhase, CardSet } from './shared/types';
import { generateRoomCode, useMultiplayerGame } from './hooks/useMultiplayerGame';
import { useCustomCardSets } from './hooks/useCustomCardSets';

enum AppMode {
  MENU = 'menu',
  SINGLE_PLAYER_LOBBY = 'sp_lobby',
  SINGLE_PLAYER_GAME = 'sp_game',
  MULTIPLAYER_WAITING = 'mp_waiting',
  MULTIPLAYER_GAME = 'mp_game',
  CARD_SET_EDITOR = 'cardset_editor',
}

// Wrapper component for multiplayer that holds the connection
function MultiplayerWrapper({
  roomCode,
  playerName,
  mode,
  onLeave,
  onGameStart,
  onReturnToWaiting,
}: {
  roomCode: string;
  playerName: string;
  mode: AppMode.MULTIPLAYER_WAITING | AppMode.MULTIPLAYER_GAME;
  onLeave: () => void;
  onGameStart: () => void;
  onReturnToWaiting: () => void;
}) {
  // Track if we've already triggered game start to prevent double-calling
  const hasTriggeredGameStart = React.useRef(false);

  const multiplayerHook = useMultiplayerGame({
    roomCode,
    playerName,
    onError: useCallback((err: { code: string; message: string }) => console.error(err), []),
    onKicked: onLeave,
    onRoomExpired: useCallback((_reason: string) => {
      onLeave();
    }, [onLeave]),
  });

  const phase = multiplayerHook.roomState?.phase;

  // Check if game has started (not in WAITING phase)
  const isGamePhase = phase === RoomPhase.PLAYING ||
    phase === RoomPhase.COUNTDOWN ||
    phase === RoomPhase.ROUND_END ||
    phase === RoomPhase.GAME_OVER;

  // Trigger navigation when game starts (from waiting room) - use setTimeout to avoid setState during render
  React.useEffect(() => {
    if (mode === AppMode.MULTIPLAYER_WAITING && isGamePhase && !hasTriggeredGameStart.current) {
      hasTriggeredGameStart.current = true;
      // Use setTimeout to defer the state update
      setTimeout(() => {
        onGameStart();
      }, 0);
    }
  }, [mode, isGamePhase, onGameStart]);

  // Transition back to waiting room when room resets after Play Again
  // This happens when phase returns to WAITING while we're in game mode
  React.useEffect(() => {
    if (mode === AppMode.MULTIPLAYER_GAME && phase === RoomPhase.WAITING) {
      // Room has been reset - go back to waiting room
      setTimeout(() => {
        onReturnToWaiting();
      }, 0);
    }
  }, [mode, phase, onReturnToWaiting]);

  // Reset the ref when going back to waiting mode
  React.useEffect(() => {
    if (mode === AppMode.MULTIPLAYER_WAITING) {
      hasTriggeredGameStart.current = false;
    }
  }, [mode]);

  // Show game screen based on server phase (source of truth)
  const shouldShowGame = isGamePhase;

  if (!shouldShowGame) {
    return (
      <WaitingRoom
        roomCode={roomCode}
        playerName={playerName}
        onLeave={onLeave}
        multiplayerHook={multiplayerHook}
      />
    );
  }

  return (
    <MultiplayerGame
      roomCode={roomCode}
      playerName={playerName}
      onExit={onLeave}
      multiplayerHook={multiplayerHook}
    />
  );
}

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.MENU);
  const [singlePlayerConfig, setSinglePlayerConfig] = useState<GameConfig | null>(null);
  const [multiplayerContext, setMultiplayerContext] = useState<{
    roomCode: string;
    playerName: string;
  } | null>(null);
  const [editingCardSet, setEditingCardSet] = useState<CardSet | null>(null);
  const { createSet, updateSet, deleteSet } = useCustomCardSets();

  const handleSinglePlayer = () => {
    setMode(AppMode.SINGLE_PLAYER_LOBBY);
  };

  // Card Set Editor handlers
  const handleCreateCardSet = useCallback(() => {
    setEditingCardSet(null); // null means creating new
    setMode(AppMode.CARD_SET_EDITOR);
  }, []);

  const handleEditCardSet = useCallback((cardSet: CardSet) => {
    setEditingCardSet(cardSet);
    setMode(AppMode.CARD_SET_EDITOR);
  }, []);

  const handleSaveCardSet = useCallback((name: string, symbols: string[]) => {
    if (editingCardSet) {
      // Editing existing
      updateSet(editingCardSet.id, name, symbols);
    } else {
      // Creating new
      createSet(name, symbols);
    }
    setEditingCardSet(null);
    setMode(AppMode.SINGLE_PLAYER_LOBBY);
  }, [editingCardSet, createSet, updateSet]);

  const handleDeleteCardSet = useCallback(() => {
    if (editingCardSet) {
      deleteSet(editingCardSet.id);
      setEditingCardSet(null);
      setMode(AppMode.SINGLE_PLAYER_LOBBY);
    }
  }, [editingCardSet, deleteSet]);

  const handleCancelCardSetEditor = useCallback(() => {
    setEditingCardSet(null);
    setMode(AppMode.SINGLE_PLAYER_LOBBY);
  }, []);

  const handleCreateRoom = (playerName: string) => {
    const roomCode = generateRoomCode();
    setMultiplayerContext({ roomCode, playerName });
    setMode(AppMode.MULTIPLAYER_WAITING);
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    setMultiplayerContext({ roomCode, playerName });
    setMode(AppMode.MULTIPLAYER_WAITING);
  };

  const handleStartSinglePlayer = (config: GameConfig) => {
    setSinglePlayerConfig(config);
    setMode(AppMode.SINGLE_PLAYER_GAME);
  };

  const handleBackToMenu = useCallback(() => {
    setMode(AppMode.MENU);
    setSinglePlayerConfig(null);
    setMultiplayerContext(null);
  }, []);

  const handleMultiplayerGameStart = useCallback(() => {
    setMode(AppMode.MULTIPLAYER_GAME);
  }, []);

  const handleReturnToWaiting = useCallback(() => {
    setMode(AppMode.MULTIPLAYER_WAITING);
  }, []);

  return (
    <ErrorBoundary>
      <Analytics />
      <div className="min-h-screen">
        {/* Show auth header only on non-game screens */}
        {(mode === AppMode.MENU || mode === AppMode.SINGLE_PLAYER_LOBBY || mode === AppMode.MULTIPLAYER_WAITING || mode === AppMode.CARD_SET_EDITOR) && (
          <header className="fixed top-4 right-4 z-50 flex items-center gap-2">
            <SignedOut>
              <SignInButton>
                <button className="px-4 py-2 text-white bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="px-4 py-2 text-white bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors">
                  Sign up
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-8 h-8',
                  },
                }}
              />
            </SignedIn>
          </header>
        )}
        {mode === AppMode.MENU && (
          <MainMenu
            onSinglePlayer={handleSinglePlayer}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {mode === AppMode.SINGLE_PLAYER_LOBBY && (
          <SinglePlayerLobby
            onStart={handleStartSinglePlayer}
            onBack={handleBackToMenu}
            onCreateCardSet={handleCreateCardSet}
            onEditCardSet={handleEditCardSet}
          />
        )}

        {mode === AppMode.CARD_SET_EDITOR && (
          <CardSetEditor
            existingSet={editingCardSet || undefined}
            onSave={handleSaveCardSet}
            onCancel={handleCancelCardSetEditor}
            onDelete={editingCardSet ? handleDeleteCardSet : undefined}
          />
        )}

        {mode === AppMode.SINGLE_PLAYER_GAME && singlePlayerConfig && (
          <SinglePlayerGame
            config={singlePlayerConfig}
            onExit={handleBackToMenu}
          />
        )}

        {(mode === AppMode.MULTIPLAYER_WAITING || mode === AppMode.MULTIPLAYER_GAME) && multiplayerContext && (
          <MultiplayerWrapper
            roomCode={multiplayerContext.roomCode}
            playerName={multiplayerContext.playerName}
            mode={mode}
            onLeave={handleBackToMenu}
            onGameStart={handleMultiplayerGameStart}
            onReturnToWaiting={handleReturnToWaiting}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;
