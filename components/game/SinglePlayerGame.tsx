import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameConfig, Player, CardData, SymbolItem, GameState, CardDifficulty, GameDuration } from '../../shared/types';
import { generateDeck, findMatch, shuffle } from '../../shared/gameLogic';
import { startBackgroundMusic, stopBackgroundMusic, playMatchSound, playErrorSound, playVictorySound } from '../../utils/sound';
import { BOT_SPEEDS, PENALTY_DURATION, BOT_NAMES, SYMBOLS_HARD, SYMBOLS_INSANE } from '../../constants';
import Card from '../Card';
import { Trophy, XCircle, Zap } from 'lucide-react';

interface SinglePlayerGameProps {
  config: GameConfig;
  onExit: () => void;
}

const SinglePlayerGame: React.FC<SinglePlayerGameProps> = ({ config, onExit }) => {
  // State
  const [players, setPlayers] = useState<Player[]>([]);
  const [centerCard, setCenterCard] = useState<CardData | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.PLAYING);
  const [penaltyUntil, setPenaltyUntil] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [lastWinnerId, setLastWinnerId] = useState<string | null>(null);

  // Highlighting State
  const [matchedSymbolId, setMatchedSymbolId] = useState<number | null>(null);

  // Responsive State
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Refs for bot timers
  const botTimers = useRef<{ [key: string]: number }>({});

  // Helper to clear timers
  const clearAllBotTimers = useCallback(() => {
    Object.values(botTimers.current).forEach((t) => clearTimeout(t as number));
    botTimers.current = {};
  }, []);

  // Window Resize Listener
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate responsive card size - optimized for mobile
  const calculateCardSize = () => {
    const { width, height } = dimensions;
    const isMobile = width < 768;
    const isPortrait = height > width;

    // Tighter spacing on mobile
    const topBarHeight = isMobile ? 40 : 48;
    const botRowHeight = isMobile ? 48 : 72;  // Tiny bot indicators on mobile (extra space for badges)
    const padding = isMobile ? 4 : 32;  // Less edge padding on mobile
    const cardGap = isMobile ? 16 : 32;  // More gap between cards for breathing room

    const availableHeight = height - topBarHeight - botRowHeight - padding * 2;
    const availableWidth = width - padding * 2;

    let cardSize: number;

    if (isMobile && isPortrait) {
      // Portrait mobile: cards stack vertically, can use full width
      // Two cards + gap must fit in available height
      const maxHeightPerCard = (availableHeight - cardGap) / 2;
      const maxWidth = availableWidth * 0.85; // Cards can be 85% of screen width
      cardSize = Math.min(maxHeightPerCard, maxWidth, 380);
    } else if (isMobile) {
      // Landscape mobile: cards side by side
      const heightConstraint = availableHeight * 0.75;
      const widthConstraint = (availableWidth - cardGap) / 2 * 0.9;
      cardSize = Math.min(heightConstraint, widthConstraint, 380);
    } else {
      // Desktop/tablet: cards side by side with more padding
      const heightConstraint = availableHeight * 0.6;
      const widthConstraint = availableWidth * 0.35;
      cardSize = Math.min(heightConstraint, widthConstraint, 380);
    }

    return Math.max(140, cardSize);
  };

  const cardSize = calculateCardSize();
  const isMobile = dimensions.width < 768;
  // Tiny bot cards on mobile - just indicators, not detailed views
  const botCardSize = isMobile ? 32 : Math.max(50, cardSize * 0.25);

  // Initialize/Restart Game Logic
  const startNewGame = useCallback(() => {
    clearAllBotTimers();
    // Use appropriate symbols for card difficulty
    const symbols = config.cardDifficulty === CardDifficulty.HARD
      ? SYMBOLS_HARD
      : config.cardDifficulty === CardDifficulty.INSANE
        ? SYMBOLS_INSANE
        : undefined;
    const generatedDeck = generateDeck(7, symbols);

    // Truncate deck based on game duration setting
    const gameDuration = config.gameDuration ?? GameDuration.LONG;
    const deckSize = Math.min(gameDuration, generatedDeck.length);
    const deck = generatedDeck.slice(0, deckSize);

    // Start background music (also called in Lobby for initial game, but needed for Play Again)
    startBackgroundMusic();

    // Shuffle the deck
    const shuffledDeck = shuffle([...deck]);

    // Setup Players
    const newPlayers: Player[] = [];
    const playerCount = 1 + config.botCount;  // Human + bots

    // Card distribution: 1 to center, rest divided equally, extras discarded
    const cardsForPlayers = shuffledDeck.length - 1;  // -1 for center card
    const cardsPerPlayer = Math.floor(cardsForPlayers / playerCount);

    // Human Player
    newPlayers.push({
      id: 'player',
      name: config.playerName,
      isBot: false,
      cardStack: []
    });

    // Bots - use human names, filter out player's name, shuffle
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
        cardStack: []
      });
    }

    // Set center card first
    const center = shuffledDeck.pop();
    setCenterCard(center || null);

    // Deal stacks to players
    let cardIndex = 0;
    newPlayers.forEach(p => {
      p.cardStack = [];
      for (let i = 0; i < cardsPerPlayer; i++) {
        p.cardStack.push(shuffledDeck[cardIndex++]);
      }
    });

    setPlayers(newPlayers);
    setGameState(GameState.PLAYING);
    setMessage('Match the Snap Card!');
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
      if (player.isBot && player.cardStack.length > 0) {
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
    if (!winner || winner.cardStack.length === 0) return;

    const topCard = winner.cardStack[0];
    // Find the symbol that matched for the highlight
    const matchSymbol = findMatch(topCard, targetCenterCard);

    // 1. Play Sound
    const isHuman = !winner.isBot;
    playMatchSound(isHuman ? -1 : parseInt(playerId.split('-')[1]), isHuman);

    // 2. Set Highlight State
    setMatchedSymbolId(matchSymbol?.id || null);
    setLastWinnerId(playerId);
    setGameState(GameState.ROUND_ANIMATION); // Pauses the game loop

    setMessage(`${winner.name} found it!`);

    // 3. Wait 2 seconds before moving to next round
    setTimeout(() => {
      proceedToNextTurn(playerId);
    }, 2000);
  };

  const proceedToNextTurn = (winnerId: string) => {
    // Find the winner and their top card BEFORE state updates
    const winner = players.find(p => p.id === winnerId);
    if (!winner || winner.cardStack.length === 0) return;

    const topCard = winner.cardStack[0];
    const newStackLength = winner.cardStack.length - 1;

    // Update center card to winner's top card
    setCenterCard(topCard);

    // Update players - remove top card from winner's stack
    setPlayers(prevPlayers => {
      const winnerIndex = prevPlayers.findIndex(p => p.id === winnerId);
      if (winnerIndex === -1) return prevPlayers;

      const currentWinner = prevPlayers[winnerIndex];
      const updatedPlayers = [...prevPlayers];
      const newStack = [...currentWinner.cardStack];
      newStack.shift(); // Remove top card

      updatedPlayers[winnerIndex] = {
        ...currentWinner,
        cardStack: newStack
      };

      return updatedPlayers;
    });

    // Check for game over: winner has no cards left
    if (newStackLength === 0) {
      endGame(winnerId);
    } else {
      // Reset States and continue
      setMatchedSymbolId(null);
      setGameState(GameState.PLAYING); // Resumes bot timers via useEffect
      setMessage('Match the Snap Card!');
    }
  };

  const endGame = (winnerId?: string) => {
    clearAllBotTimers();
    setLastWinnerId(winnerId || null);
    stopBackgroundMusic();
    playVictorySound();

    // Show victory celebration for 3 seconds before scoreboard
    setGameState(GameState.VICTORY_CELEBRATION);
    const winner = winnerId ? players.find(p => p.id === winnerId) : null;
    setMessage(winner ? `${winner.name} wins!` : 'Game Over!');

    setTimeout(() => {
      setGameState(GameState.GAME_OVER);
    }, 3000);
  };

  const handlePlayerClick = (symbol: SymbolItem) => {
    if (gameState !== GameState.PLAYING) return;

    const now = Date.now();
    if (now < penaltyUntil) return;

    const human = players.find(p => !p.isBot);
    if (!human || human.cardStack.length === 0 || !centerCard) return;

    const topCard = human.cardStack[0];
    // Check match
    const inPlayerHand = topCard.symbols.some(s => s.id === symbol.id);
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

  // Victory celebration screen with floating confetti
  if (gameState === GameState.VICTORY_CELEBRATION) {
    const sortedPlayers = [...players].sort((a, b) => a.cardStack.length - b.cardStack.length);
    const winner = sortedPlayers[0];
    const isHumanWinner = winner?.id === 'player';
    const confettiEmojis = ['🎉', '🎊', '🎈', '⭐', '✨', '🌟', '🏆'];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-hidden">
        {/* Winner text */}
        <div className="text-center z-10">
          <div className="text-5xl md:text-7xl font-black text-white drop-shadow-lg mb-4 animate-bounce">
            {isHumanWinner ? 'YOU WIN!' : `${winner?.name} WINS!`}
          </div>
        </div>

        {/* Floating confetti emojis */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-4xl md:text-5xl"
              style={{
                left: `${(i * 5) % 100}%`,
                bottom: '-10%',
                animation: `floatUp ${2 + (i % 3)}s ease-out forwards`,
                animationDelay: `${(i * 0.1) % 1}s`,
              }}
            >
              {confettiEmojis[i % confettiEmojis.length]}
            </div>
          ))}
        </div>

        {/* CSS for float animation */}
        <style>{`
          @keyframes floatUp {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(-120vh) rotate(360deg); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    // Sort by cards remaining ascending (0 = winner)
    const sortedPlayers = [...players].sort((a, b) => a.cardStack.length - b.cardStack.length);
    const winner = sortedPlayers[0];
    const isHumanWinner = winner.id === 'player';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white p-4 animate-fadeIn">
        <div className="bg-white text-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center flex flex-col max-h-[90vh]">
          <div className="shrink-0">
            <Trophy className={`w-24 h-24 mx-auto mb-4 ${isHumanWinner ? 'text-yellow-400' : 'text-gray-400'}`} />
            <h2 className="text-4xl font-bold mb-2">{isHumanWinner ? 'You Won!' : `${winner.name} Wins!`}</h2>
            <p className="text-gray-500 mb-6">Final Standings</p>
          </div>

          <div className="space-y-3 mb-8 overflow-y-auto flex-1">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-gray-100 rounded-xl font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-6">#{idx + 1}</span>
                  <span>{p.name}</span>
                </div>
                <span className={p.cardStack.length === 0 ? 'text-green-600' : 'text-indigo-600'}>
                  {p.cardStack.length === 0 ? 'WINNER!' : p.cardStack.length}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center shrink-0">
            <button
              onClick={handleExit}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 transition"
            >
              Exit
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
      <div className="flex flex-col h-screen bg-slate-100 overflow-hidden safe-all">
        {/* Top Bar: Stats - tighter on mobile */}
        <div className="bg-white shadow-sm h-10 sm:h-12 shrink-0 px-2 md:px-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-2 md:gap-4">
             <button onClick={handleExit} className="text-slate-500 hover:text-red-600 font-bold text-xs md:text-sm px-2 md:px-3 py-1 rounded hover:bg-slate-100 transition-colors">EXIT</button>
          </div>
          <div className="font-bold text-sm md:text-lg text-slate-700 truncate max-w-[40%]">{message}</div>
          <div className="flex items-center gap-2">
              <div className={`px-2 md:px-3 py-1 rounded-lg flex items-center gap-1 md:gap-2 ${isPenaltyActive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                 {isPenaltyActive ? <XCircle size={16}/> : <Zap size={16}/>}
                 <span className="font-bold text-xs md:text-sm">{isPenaltyActive ? `WAIT ${timeLeft}s` : 'READY'}</span>
              </div>
          </div>
        </div>

        {/* Game Arena */}
        <div className="flex-1 flex flex-col relative w-full h-full">

          {/* Bot Row - Top of screen, tiny indicators on mobile */}
          <div className="flex justify-center items-start pt-0.5 gap-0.5 sm:gap-3 md:gap-6 shrink-0 min-h-[48px] sm:min-h-[72px] z-20 relative overflow-visible">
            {bots.map(bot => (
              <div
                key={bot.id}
                className={`flex flex-col items-center transition-all duration-300 ${
                  lastWinnerId === bot.id
                    ? 'scale-110'
                    : 'opacity-70 scale-90'
                }`}
              >
                 {/* GOT IT! badge above winner */}
                 {lastWinnerId === bot.id && isAnimating && (
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full shadow-md z-10">
                     GOT IT!
                   </div>
                 )}
                 <div className="relative">
                   {bot.cardStack.length > 0 && (
                     <Card
                       card={bot.cardStack[0]}
                       size={lastWinnerId === bot.id && isAnimating ? botCardSize * 1.5 : botCardSize}
                       layoutMode={config.cardDifficulty}
                       highlightSymbolId={lastWinnerId === bot.id && isAnimating ? matchedSymbolId : null}
                       disabled
                       className={lastWinnerId === bot.id && isAnimating ? "bg-yellow-50 ring-4 ring-yellow-400" : "bg-gray-50"}
                       interactive={false}
                     />
                   )}
                   <div className="absolute -bottom-0.5 -right-0.5 bg-indigo-600 text-white text-[8px] sm:text-xs font-bold w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border border-white shadow z-30">
                     {bot.cardStack.length}
                   </div>
                 </div>
                 <span className="text-[8px] sm:text-xs font-bold mt-0.5 text-gray-500 truncate max-w-[40px] sm:max-w-none">{bot.name}</span>
              </div>
            ))}
          </div>

          {/* Main Card Area - Evenly spaced on mobile, centered on desktop */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-evenly md:justify-center max-w-6xl mx-auto w-full gap-4 sm:gap-6 md:gap-8 px-1 sm:px-4 md:px-10">

            {/* Player Hand (LEFT) */}
            <div className="relative">
               {humanPlayer && humanPlayer.cardStack.length > 0 && (
                 <Card
                   card={humanPlayer.cardStack[0]}
                   size={cardSize}
                   layoutMode={config.cardDifficulty}
                   onClickSymbol={handlePlayerClick}
                   disabled={isPenaltyActive || isAnimating}
                   highlightError={isPenaltyActive}
                   highlightSymbolId={lastWinnerId === 'player' && isAnimating ? matchedSymbolId : null}
                   className={`border-indigo-500 shadow-indigo-200 hover:scale-[1.02] transition-transform ${
                     lastWinnerId === 'player' && isAnimating ? 'bg-yellow-50 ring-4 ring-yellow-400' : 'bg-indigo-50'
                   }`}
                   interactive={true}
                   label={humanPlayer.name}
                 />
               )}
               {/* Penalty Overlay */}
               {isPenaltyActive && (
                 <div className="absolute inset-0 bg-red-500/20 rounded-full z-20 flex items-center justify-center backdrop-blur-[2px] animate-pulse pointer-events-none">
                   <XCircle className="text-red-600 w-16 h-16 drop-shadow-lg" />
                 </div>
               )}
               <div className="absolute bottom-[12%] right-[3%] bg-indigo-600 text-white text-base font-bold w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10">
                  {humanPlayer?.cardStack.length ?? 0}
               </div>
            </div>

            {/* The Deck / Snap Card (RIGHT) */}
            <div className="relative group">
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
                 <div style={{ width: cardSize, height: cardSize }} className="rounded-full bg-gray-200 border-4 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-bold">
                   Empty
                 </div>
               )}
            </div>

          </div>

          {/* Instructions */}
          <div className="mt-4 text-center max-w-md text-gray-500 text-xs md:text-sm hidden md:block">
            Find the ONE symbol that matches between <strong>SNAP CARD</strong> and <strong>YOUR</strong> card. Click it on <strong>YOUR</strong> card!
          </div>

        </div>
      </div>
  );
};

export default SinglePlayerGame;
