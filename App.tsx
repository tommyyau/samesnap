import React, { useState, useCallback } from 'react';
import MainMenu from './components/lobby/MainMenu';
import SinglePlayerLobby from './components/lobby/SinglePlayerLobby';
import SinglePlayerGame from './components/game/SinglePlayerGame';
import WaitingRoom from './components/lobby/WaitingRoom';
import MultiplayerGame from './components/game/MultiplayerGame';
import { GameConfig, RoomPhase } from './shared/types';
import { generateRoomCode, useMultiplayerGame } from './hooks/useMultiplayerGame';

enum AppMode {
  MENU = 'menu',
  SINGLE_PLAYER_LOBBY = 'sp_lobby',
  SINGLE_PLAYER_GAME = 'sp_game',
  MULTIPLAYER_WAITING = 'mp_waiting',
  MULTIPLAYER_GAME = 'mp_game',
}

// Wrapper component for multiplayer that holds the connection
function MultiplayerWrapper({
  roomCode,
  playerName,
  mode,
  onLeave,
  onGameStart,
}: {
  roomCode: string;
  playerName: string;
  mode: AppMode.MULTIPLAYER_WAITING | AppMode.MULTIPLAYER_GAME;
  onLeave: () => void;
  onGameStart: () => void;
}) {
  // Track if we've already triggered game start to prevent double-calling
  const hasTriggeredGameStart = React.useRef(false);

  const multiplayerHook = useMultiplayerGame({
    roomCode,
    playerName,
    onError: useCallback((err: { code: string; message: string }) => console.error(err), []),
    onKicked: onLeave,
    onRoomExpired: useCallback((reason: string) => {
      alert(reason);
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

  // Reset the ref when going back to waiting mode
  React.useEffect(() => {
    if (mode === AppMode.MULTIPLAYER_WAITING) {
      hasTriggeredGameStart.current = false;
    }
  }, [mode]);

  // Show game screen if we're in game mode OR if game has started
  const shouldShowGame = mode === AppMode.MULTIPLAYER_GAME || isGamePhase;

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

  const handleSinglePlayer = () => {
    setMode(AppMode.SINGLE_PLAYER_LOBBY);
  };

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

  return (
    <div className="min-h-screen">
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
        />
      )}
    </div>
  );
}

export default App;
