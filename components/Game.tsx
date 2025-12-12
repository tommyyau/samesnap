import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameConfig, Player, CardData, SymbolItem, GameState, CardDifficulty } from '../types';
import { generateDeck, findMatch, shuffle } from '../utils/gameLogic';
import { stopBackgroundMusic, playMatchSound, playErrorSound } from '../utils/sound';
import { BOT_SPEEDS, PENALTY_DURATION, BOT_NAMES, SYMBOLS_HARD } from '../constants';
import Card from './Card';
import { Trophy, XCircle, Zap, Smartphone, Bot } from 'lucide-react';

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

  // Responsive State
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Refs for bot timers and animation timer
  const botTimers = useRef<{ [key: string]: number }>({});
  const animationTimer = useRef<number | null>(null);

  // Helper to clear timers
  const clearAllBotTimers = useCallback(() => {
    Object.values(botTimers.current).forEach((t) => clearTimeout(t as number));
    botTimers.current = {};
    if (animationTimer.current !== null) {
      clearTimeout(animationTimer.current);
      animationTimer.current = null;
    }
  }, []);

  // Window Resize Listener
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize/Restart Game Logic
  const startNewGame = useCallback(() => {
    clearAllBotTimers();
    // Use hard symbols for HARD card difficulty
    const symbols = config.cardDifficulty === CardDifficulty.HARD ? SYMBOLS_HARD : undefined;
    const deck = generateDeck(7, symbols);

    // Note: Audio is started in Lobby.tsx during user gesture (required for iOS)

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
    // Filter out player's name (case-insensitive) to avoid duplicates, then shuffle
    const playerNameLower = config.playerName.toLowerCase();
    const availableBotNames = BOT_NAMES.filter(
      name => name.toLowerCase() !== playerNameLower
    );
    const shuffledNames = shuffle([...availableBotNames]);

    for (let i = 0; i < config.botCount; i++) {
      newPlayers.push({
        id: `bot-${i}`,
        name: shuffledNames[i % shuffledNames.length],
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
    setMessage('Match the Center Card!');
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

  // Game End Detection - watch for empty draw pile
  // Only triggers when: playing + pile empty + game actually started (has center card)
  useEffect(() => {
    if (gameState === GameState.PLAYING && drawPile.length === 0 && centerCard) {
      endGame();
    }
  }, [drawPile.length, gameState, centerCard]);

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
    
    setMessage(`${winner.name} found it!`);

    // 3. Wait 2 seconds before dealing next card
    animationTimer.current = window.setTimeout(() => {
      animationTimer.current = null;
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

    // Draw new center card from pile
    setDrawPile(prevPile => {
      const newPile = [...prevPile];
      if (newPile.length > 0) {
        const newCenter = newPile.pop();
        setCenterCard(newCenter || null);
      }
      return newPile;
    });

    // Reset states and continue playing
    // (useEffect will detect empty pile and end game if needed)
    setMatchedSymbolId(null);
    setLastWinnerId(null);
    setGameState(GameState.PLAYING);
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
      setMessage("Miss! 3s Penalty!");
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

  // --- Dynamic Layout Calculations ---

  // Check if we are in "Mobile Portrait" mode
  const isMobilePortrait = dimensions.width < 768 && dimensions.height > dimensions.width;

  // Calculate optimized card size - maximize for mobile landscape
  // Text is now on circumference, so we can use full card interior
  const calculateCardSize = () => {
    const { width, height } = dimensions;
    const isSmallScreen = width < 768;

    if (isSmallScreen) {
      // Mobile Landscape - maximize card size
      // Fixed elements: top bar (48px), bot row (60px), padding (24px total)
      const topBarHeight = 48;
      const botRowHeight = 60;
      const verticalPadding = 24;
      const usableHeight = height - topBarHeight - botRowHeight - verticalPadding;

      // Two cards side by side with gap (32px) and horizontal padding (32px)
      const horizontalPadding = 32;
      const cardGap = 32;
      const usableWidth = (width - horizontalPadding - cardGap) / 2;

      // Use 95% of the smaller constraint, with 10% extra for label overflow
      const heightConstraint = usableHeight * 0.90;
      const widthConstraint = usableWidth * 0.90;

      return Math.min(heightConstraint, widthConstraint);
    }

    // Desktop - larger cards
    return Math.min(480, width * 0.38, height * 0.55);
  };

  const cardSize = calculateCardSize();
  const botCardSize = Math.max(50, cardSize * 0.25); 

  if (gameState === GameState.GAME_OVER) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const isHumanWinner = winner.id === 'player';

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-indigo-900 text-white p-4 animate-fadeIn overflow-hidden">
        <div className="bg-white text-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center flex flex-col max-h-[90vh]">
          {/* Header - fixed */}
          <div className="shrink-0">
            <Trophy className={`w-16 h-16 md:w-24 md:h-24 mx-auto mb-2 md:mb-4 ${isHumanWinner ? 'text-yellow-400' : 'text-gray-400'}`} />
            <h2 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">{isHumanWinner ? 'You Won!' : `${winner.name} Wins!`}</h2>
            <p className="text-gray-500 mb-4 md:mb-6 text-sm md:text-base">Final Scores</p>
          </div>

          {/* Scrollable player list */}
          <div className="space-y-2 md:space-y-3 mb-4 md:mb-6 overflow-y-auto flex-1 min-h-0">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className="flex justify-between items-center p-2 md:p-3 bg-gray-100 rounded-xl font-bold text-sm md:text-base">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-6">#{idx + 1}</span>
                  <span>{p.name}</span>
                </div>
                <span className="text-indigo-600">{p.score} cards</span>
              </div>
            ))}
          </div>

          {/* Buttons - fixed at bottom */}
          <div className="flex gap-4 justify-center shrink-0 pt-2">
            <button
              onClick={handleExit}
              className="px-4 md:px-6 py-2 md:py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 transition text-sm md:text-base"
            >
              Exit
            </button>
            <button
              onClick={startNewGame}
              className="px-4 md:px-6 py-2 md:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg text-sm md:text-base"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Orientation Enforcer Overlay */}
      {isMobilePortrait && (
        <div className="fixed inset-0 z-50 bg-indigo-900 text-white flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="relative mb-8">
            <Smartphone size={64} className="animate-spin-slow" />
            <div className="absolute top-0 right-0 -mr-4 -mt-2">
              <Zap className="text-yellow-400 animate-pulse" size={24}/>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-4">Please Rotate Your Device</h2>
          <p className="text-indigo-200 mb-8 max-w-xs">
            SameSnap is designed to be played in landscape mode for the best experience.
          </p>
          <div className="text-sm opacity-50 font-mono border border-indigo-700 px-3 py-1 rounded">
            Rotate to continue
          </div>
        </div>
      )}

      {/* Main Game Container */}
      <div className={`flex flex-col h-screen bg-slate-100 overflow-hidden ${isMobilePortrait ? 'blur-sm' : ''}`}>
        
        {/* Top Bar: Compact */}
        <div className="bg-white shadow-sm px-4 py-2 flex justify-between items-center z-10 h-12 shrink-0">
          <button onClick={handleExit} className="text-slate-500 hover:text-red-600 font-bold text-xs md:text-sm px-2 py-1 rounded hover:bg-slate-100 transition-colors">
            EXIT
          </button>
          
          <div className="flex flex-col items-center">
             <div className="font-bold text-sm md:text-base text-slate-700 leading-tight">{message}</div>
          </div>

          <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 md:gap-2 bg-indigo-50 px-2 md:px-3 py-1 rounded-lg mr-1 md:mr-2">
                <span className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Pile</span>
                <span className="font-bold text-xs md:text-sm text-indigo-700">{drawPile.length}</span>
              </div>
              <div className={`px-2 py-1 md:px-3 rounded-lg flex items-center gap-1 md:gap-2 ${isPenaltyActive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                 {isPenaltyActive ? <XCircle size={14}/> : <Zap size={14}/>}
                 <span className="font-bold text-xs md:text-sm whitespace-nowrap">{isPenaltyActive ? `${timeLeft}s` : 'READY'}</span>
              </div>
          </div>
        </div>

        {/* Game Arena */}
        <div className="flex-1 flex flex-col relative w-full h-full">
          
          {/* Bot Row - Top of screen */}
          <div className="flex justify-center items-start pt-2 gap-3 md:gap-6 shrink-0 h-[60px] z-50">
            {bots.map(bot => {
              const isWinner = lastWinnerId === bot.id;
              return (
                <div key={bot.id} className={`flex flex-col items-center transition-all duration-300 ${isWinner ? 'scale-110' : 'opacity-70 scale-90'}`}>
                   <div className="relative">
                     {isWinner && bot.hand ? (
                        <div className="animate-in zoom-in duration-300 relative z-30">
                           <Card
                             card={bot.hand}
                             size={botCardSize * 1.5}
                             layoutMode={config.cardDifficulty}
                             highlightSymbolId={matchedSymbolId}
                             disabled
                             className="bg-yellow-50 border-yellow-400 border-4 shadow-xl"
                             interactive={false}
                           />
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border border-white z-40">
                             GOT IT!
                           </div>
                        </div>
                     ) : (
                        <div 
                          className="rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center text-slate-500 shadow-sm transition-all"
                          style={{ width: 36, height: 36 }}
                        >
                            <Bot size={20} />
                        </div>
                     )}
                     
                     <div className={`absolute -bottom-1 -right-1 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow transition-colors z-30 ${isWinner ? 'bg-yellow-500 text-white' : 'bg-indigo-500 text-white'}`}>
                       {bot.score}
                     </div>
                   </div>
                   {!isWinner && (
                     <span className="text-[9px] md:text-[10px] font-bold mt-1 text-slate-400 max-w-[65px] md:max-w-[80px] truncate">
                        {bot.name}
                     </span>
                   )}
                </div>
              );
            })}
          </div>

          {/* Main Card Area - Centered and High */}
          <div className="flex-1 flex items-center justify-around max-w-6xl mx-auto w-full gap-8 pb-4 px-4 md:px-10">
            
            {/* Player Hand (LEFT) */}
            <div className="relative group">
               {humanPlayer?.hand && (
                 <Card 
                   card={humanPlayer.hand} 
                   size={cardSize}
                   layoutMode={config.cardDifficulty}
                   onClickSymbol={handlePlayerClick}
                   disabled={isPenaltyActive || isAnimating} 
                   highlightError={isPenaltyActive}
                   className="border-indigo-500 bg-indigo-50 shadow-indigo-200 hover:scale-[1.02]"
                   interactive={true}
                   label={humanPlayer.name}
                 />
               )}

               {/* Penalty Overlay */}
               {isPenaltyActive && (
                 <div className="absolute inset-0 bg-red-500/20 rounded-full z-20 flex items-center justify-center backdrop-blur-[2px] animate-pulse pointer-events-none">
                   <XCircle className="text-red-600 w-12 h-12 md:w-16 md:h-16 drop-shadow-lg" />
                 </div>
               )}

               {/* Score Badge - Attached to 5 o'clock position (approx 85% right, 85% bottom) */}
               {/* 42% offset from center for 5 o'clock approx */}
               <div className="absolute top-[85%] left-[85%] -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white text-lg font-bold w-12 h-12 rounded-full flex items-center justify-center border-4 border-slate-100 shadow-lg z-20 pointer-events-none">
                  {humanPlayer?.score || 0}
               </div>
            </div>

            {/* The Deck / Center Card (RIGHT) */}
            <div className="relative">
               {centerCard ? (
                 <Card 
                   card={centerCard} 
                   size={cardSize}
                   layoutMode={config.cardDifficulty}
                   highlightSymbolId={matchedSymbolId}
                   disabled={isPenaltyActive || isAnimating}
                   className="z-10 relative"
                   interactive={false}
                   label="Snap Card"
                 />
               ) : (
                 <div style={{ width: cardSize, height: cardSize }} className="flex items-center justify-center">
                    {/* Placeholder matching the Card layout for visual stability */}
                    <div className="w-full h-full rounded-full bg-gray-200 border-4 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-bold text-xs md:text-base">
                        Empty
                    </div>
                 </div>
               )}
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default Game;