import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameConfig, Player, CardData, SymbolItem, GameState } from '../types';
import { generateDeck, findMatch, checkMatch } from '../utils/gameLogic';
import { startBackgroundMusic, stopBackgroundMusic, playMatchSound, playErrorSound } from '../utils/sound';
import { BOT_SPEEDS, PENALTY_DURATION, CARD_SIZE_LG, CARD_SIZE_MD, CARD_SIZE_SM } from '../constants';
import Card from './Card';
import { Trophy, Clock, RefreshCw, XCircle, User, Zap } from 'lucide-react';

interface GameProps {
  config: GameConfig;
  onExit: () => void;
}

const Game: React.FC<GameProps> = ({ config, onExit }) => {
  // State
  const [players, setPlayers] = useState<Player[]>([]);
  const [drawPile, setDrawPile] = useState<CardData[]>([]);
  const [centerCard, setCenterCard] = useState<CardData | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.PLAYING);
  const [penaltyUntil, setPenaltyUntil] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [lastWinnerId, setLastWinnerId] = useState<string | null>(null);
  
  // Highlighting State
  const [matchedSymbolId, setMatchedSymbolId] = useState<number | null>(null);

  // Refs for bot timers
  const botTimers = useRef<{ [key: string]: number }>({});

  // Helper to clear timers
  const clearAllBotTimers = useCallback(() => {
    Object.values(botTimers.current).forEach((t) => clearTimeout(t as number));
    botTimers.current = {};
  }, []);

  // Initialize/Restart Game Logic
  const startNewGame = useCallback(() => {
    clearAllBotTimers();
    const deck = generateDeck();
    
    // Start Audio
    startBackgroundMusic();

    // Setup Players
    const newPlayers: Player[] = [];
    
    // Human Player
    newPlayers.push({
      id: 'player',
      name: config.playerName, 
      isBot: false,
      score: 0,
      hand: null,
      collectedCards: 0
    });

    // Bots
    for (let i = 0; i < config.botCount; i++) {
      newPlayers.push({
        id: `bot-${i}`,
        name: `Bot ${i + 1}`,
        isBot: true,
        score: 0,
        hand: null,
        collectedCards: 0
      });
    }

    // Deal one card to each player
    newPlayers.forEach(p => {
      const card = deck.pop();
      if (card) p.hand = card;
    });

    // Place one card in center
    const center = deck.pop();
    setCenterCard(center || null);

    setDrawPile(deck);
    setPlayers(newPlayers);
    setGameState(GameState.PLAYING);
    setMessage('Game Start! Match the symbol on the Center Card!');
    setLastWinnerId(null);
    setPenaltyUntil(0);
    setMatchedSymbolId(null);
  }, [config, clearAllBotTimers]);

  // Initial mount
  useEffect(() => {
    startNewGame();
    return () => {
      clearAllBotTimers();
      stopBackgroundMusic();
    };
  }, [startNewGame, clearAllBotTimers]);

  // Bot Logic System
  useEffect(() => {
    // Only run bots if the game is actively playing (not in animation/pause state)
    if (gameState !== GameState.PLAYING || !centerCard) return;

    // Schedule bots to find match
    players.forEach(player => {
      if (player.isBot && player.hand) {
        scheduleBotMove(player, centerCard);
      }
    });

    return () => clearAllBotTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerCard, gameState, players]); 

  const scheduleBotMove = (bot: Player, currentCenter: CardData) => {
    if (botTimers.current[bot.id]) clearTimeout(botTimers.current[bot.id]);

    const speedRange = BOT_SPEEDS[config.difficulty];
    // Random delay based on difficulty + some randomness
    const reactionTime = Math.random() * (speedRange[1] - speedRange[0]) + speedRange[0];

    botTimers.current[bot.id] = window.setTimeout(() => {
      handleMatchFound(bot.id, currentCenter);
    }, reactionTime);
  };

  const handleMatchFound = (playerId: string, targetCenterCard: CardData) => {
    // Prevent multiple matches firing at once
    if (gameState !== GameState.PLAYING) return;

    const winner = players.find(p => p.id === playerId);
    if (!winner || !winner.hand) return;

    // Find the symbol that matched for the highlight
    const matchSymbol = findMatch(winner.hand, targetCenterCard);
    
    // 1. Play Sound
    const isHuman = !winner.isBot;
    playMatchSound(isHuman ? -1 : parseInt(playerId.split('-')[1]), isHuman);

    // 2. Set Highlight State
    setMatchedSymbolId(matchSymbol?.id || null);
    setLastWinnerId(playerId);
    setGameState(GameState.ROUND_ANIMATION); // Pauses the game loop
    
    setMessage(`${winner.name} found the match!`);

    // 3. Wait 2 seconds before dealing next card
    setTimeout(() => {
      proceedToNextTurn(playerId, targetCenterCard);
    }, 2000);
  };

  const proceedToNextTurn = (winnerId: string, oldCenterCard: CardData) => {
    setPlayers(prevPlayers => {
      const winnerIndex = prevPlayers.findIndex(p => p.id === winnerId);
      if (winnerIndex === -1) return prevPlayers;

      const winner = prevPlayers[winnerIndex];
      const updatedPlayers = [...prevPlayers];
      updatedPlayers[winnerIndex] = {
        ...winner,
        score: winner.score + 1,
        collectedCards: winner.collectedCards + 1,
        hand: oldCenterCard // Winner takes center card
      };
      return updatedPlayers;
    });

    // Draw new center card
    setDrawPile(prevPile => {
      const newPile = [...prevPile];
      if (newPile.length === 0) {
        endGame();
        return newPile;
      }
      const newCenter = newPile.pop();
      setCenterCard(newCenter || null);
      return newPile;
    });

    // Reset States
    setMatchedSymbolId(null);
    setGameState(GameState.PLAYING); // Resumes bot timers via useEffect
    setMessage('Next Round!');
  };

  const endGame = () => {
    setGameState(GameState.GAME_OVER);
    clearAllBotTimers();
    setMessage('Game Over! No more cards.');
    stopBackgroundMusic();
  };

  const handlePlayerClick = (symbol: SymbolItem) => {
    if (gameState !== GameState.PLAYING) return;
    
    const now = Date.now();
    if (now < penaltyUntil) return;

    const human = players.find(p => !p.isBot);
    if (!human || !human.hand || !centerCard) return;

    // Check match
    const inPlayerHand = human.hand.symbols.some(s => s.id === symbol.id);
    const inCenter = centerCard.symbols.some(s => s.id === symbol.id);

    if (inPlayerHand && inCenter) {
      handleMatchFound(human.id, centerCard);
    } else {
      // Penalty
      playErrorSound();
      setPenaltyUntil(now + PENALTY_DURATION);
      setMessage("Miss! 3 second penalty!");
    }
  };

  const humanPlayer = players.find(p => !p.isBot);
  const bots = players.filter(p => p.isBot);
  const isPenaltyActive = Date.now() < penaltyUntil;
  const isAnimating = gameState === GameState.ROUND_ANIMATION;

  // Penalty Timer effect
  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (penaltyUntil > Date.now()) {
      const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((penaltyUntil - Date.now()) / 1000));
        setTimeLeft(left);
        if (left <= 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(0);
    }
  }, [penaltyUntil]);

  // Exit handler
  const handleExit = () => {
    stopBackgroundMusic();
    onExit();
  };

  if (gameState === GameState.GAME_OVER) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const isHumanWinner = winner.id === 'player';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white p-4 animate-fadeIn">
        <div className="bg-white text-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center">
          <Trophy className={`w-24 h-24 mx-auto mb-4 ${isHumanWinner ? 'text-yellow-400' : 'text-gray-400'}`} />
          <h2 className="text-4xl font-bold mb-2">{isHumanWinner ? 'You Won!' : `${winner.name} Wins!`}</h2>
          <p className="text-gray-500 mb-6">Final Scores</p>
          
          <div className="space-y-3 mb-8">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-gray-100 rounded-xl font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-6">#{idx + 1}</span>
                  <span>{p.name}</span>
                </div>
                <span className="text-indigo-600">{p.score} cards</span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <button 
              onClick={handleExit}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 transition"
            >
              Exit to Lobby
            </button>
            <button 
              onClick={startNewGame} 
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* Top Bar: Stats */}
      <div className="bg-white shadow-sm p-2 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
           <button onClick={handleExit} className="text-slate-500 hover:text-red-600 font-bold text-sm px-3 py-1 rounded hover:bg-slate-100 transition-colors">EXIT GAME</button>
           <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg">
             <span className="text-xs text-gray-500 uppercase font-bold">Pile Left</span>
             <span className="font-bold text-indigo-700">{drawPile.length}</span>
           </div>
        </div>
        <div className="font-bold text-lg text-slate-700">{message}</div>
        <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-lg flex items-center gap-2 ${isPenaltyActive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
               {isPenaltyActive ? <XCircle size={16}/> : <Zap size={16}/>}
               <span className="font-bold text-sm">{isPenaltyActive ? `WAIT ${timeLeft}s` : 'READY'}</span>
            </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4">
        
        {/* Opponents (Top) */}
        <div className="flex gap-4 mb-4 md:mb-8 overflow-x-auto w-full justify-center py-2">
          {bots.map(bot => (
            <div key={bot.id} className={`flex flex-col items-center transition-all duration-300 ${lastWinnerId === bot.id ? 'scale-110' : 'opacity-80'}`}>
               <div className="relative">
                 {bot.hand && (
                   <Card 
                     card={bot.hand} 
                     size={CARD_SIZE_SM} 
                     layoutMode={config.cardDifficulty}
                     disabled 
                     className="bg-gray-50"
                     interactive={false}
                   />
                 )}
                 <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow">
                   {bot.score}
                 </div>
               </div>
               <span className="text-xs font-bold mt-2 text-gray-500">{bot.name}</span>
               {lastWinnerId === bot.id && <div className="text-xs text-green-600 font-bold animate-bounce">Got it!</div>}
            </div>
          ))}
        </div>

        {/* Center Arena */}
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 lg:gap-24 relative">
          
          {/* Player Hand (LEFT) */}
          <div className="relative">
             <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-indigo-600 font-bold tracking-widest text-sm uppercase flex items-center gap-1 whitespace-nowrap">
                <User size={14}/> {humanPlayer?.name || 'You'}
             </div>
             {humanPlayer?.hand && (
               <Card 
                 card={humanPlayer.hand} 
                 size={window.innerWidth < 768 ? CARD_SIZE_MD : CARD_SIZE_LG}
                 layoutMode={config.cardDifficulty}
                 onClickSymbol={handlePlayerClick} // Enable clicking on self
                 disabled={isPenaltyActive || isAnimating} 
                 highlightError={isPenaltyActive}
                 className="border-indigo-500 bg-indigo-50 shadow-indigo-200 hover:scale-[1.02]"
                 interactive={true} // Enable interaction
               />
             )}
             {/* Penalty Overlay */}
             {isPenaltyActive && (
               <div className="absolute inset-0 bg-red-500/20 rounded-full z-20 flex items-center justify-center backdrop-blur-[2px] animate-pulse pointer-events-none">
                 <XCircle className="text-red-600 w-16 h-16 drop-shadow-lg" />
               </div>
             )}
             <div className="absolute -bottom-4 -right-4 bg-indigo-600 text-white text-lg font-bold w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                {humanPlayer?.score || 0}
             </div>
          </div>

          {/* The Deck / Center Card (RIGHT) */}
          <div className="relative group">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-gray-400 font-bold tracking-widest text-sm uppercase">Center</div>
             {centerCard ? (
               <Card 
                 card={centerCard} 
                 size={window.innerWidth < 768 ? CARD_SIZE_MD : CARD_SIZE_LG}
                 layoutMode={config.cardDifficulty}
                 // Pass highlight info
                 highlightSymbolId={matchedSymbolId}
                 // Non-interactive
                 disabled={isPenaltyActive || isAnimating}
                 className="z-10 relative"
                 interactive={false}
               />
             ) : (
               <div className="w-64 h-64 rounded-full bg-gray-200 border-4 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-bold">
                 Empty
               </div>
             )}
          </div>

        </div>

        {/* Instructions */}
        <div className="mt-8 text-center max-w-md text-gray-500 text-sm hidden md:block">
          Find the ONE symbol that matches between the <strong>CENTER</strong> card and <strong>YOUR</strong> card. <br/>
          Click it on <strong>YOUR</strong> card!
        </div>

      </div>
    </div>
  );
};

export default Game;