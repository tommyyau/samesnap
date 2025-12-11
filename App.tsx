import React, { useState } from 'react';
import MainMenu from './components/lobby/MainMenu';
import SinglePlayerLobby from './components/lobby/SinglePlayerLobby';
import SinglePlayerGame from './components/game/SinglePlayerGame';
import WaitingRoom from './components/lobby/WaitingRoom';
import MultiplayerGame from './components/game/MultiplayerGame';
import { GameConfig } from './shared/types';
import { generateRoomCode } from './hooks/useMultiplayerGame';

enum AppMode {
  MENU = 'menu',
  SINGLE_PLAYER_LOBBY = 'sp_lobby',
  SINGLE_PLAYER_GAME = 'sp_game',
  MULTIPLAYER_WAITING = 'mp_waiting',
  MULTIPLAYER_GAME = 'mp_game',
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

  const handleBackToMenu = () => {
    setMode(AppMode.MENU);
    setSinglePlayerConfig(null);
    setMultiplayerContext(null);
  };

  const handleMultiplayerGameStart = () => {
    setMode(AppMode.MULTIPLAYER_GAME);
  };

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

      {mode === AppMode.MULTIPLAYER_WAITING && multiplayerContext && (
        <WaitingRoom
          roomCode={multiplayerContext.roomCode}
          playerName={multiplayerContext.playerName}
          onLeave={handleBackToMenu}
          onGameStart={handleMultiplayerGameStart}
        />
      )}

      {mode === AppMode.MULTIPLAYER_GAME && multiplayerContext && (
        <MultiplayerGame
          roomCode={multiplayerContext.roomCode}
          playerName={multiplayerContext.playerName}
          onExit={handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
