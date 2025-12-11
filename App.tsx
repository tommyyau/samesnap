import React, { useState } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { GameConfig } from './types';

function App() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  return (
    <div className="min-h-screen">
      {!gameConfig ? (
        <Lobby onStart={setGameConfig} />
      ) : (
        <Game config={gameConfig} onExit={() => setGameConfig(null)} />
      )}
    </div>
  );
}

export default App;