import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameConfig, Player, CardData, SymbolItem, GameState, CardDifficulty, GameDuration } from '../../shared/types';
import { generateDeck, findMatch, shuffle } from '../../shared/gameLogic';
import { stopBackgroundMusic, playMatchSound, playErrorSound, playVictorySound } from '../../utils/sound';
import { BOT_SPEEDS, PENALTY_DURATION, BOT_NAMES, SYMBOLS_HARD } from '../../constants';
import Card from '../Card';
import { Trophy, XCircle, User, Zap, Smartphone } from 'lucide-react';

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

  // Calculate responsive card size
  const calculateCardSize = () => {
    const { width, height } = dimensions;
    const topBarHeight = 48;
    const botRowHeight = 60;
    const padding = 32;
    const availableHeight = height - topBarHeight - botRowHeight - padding * 2;
    const availableWidth = width - padding * 2;

    // Cards should fit in available space with room for both
    const heightConstraint = availableHeight * 0.6;
    const widthConstraint = availableWidth * 0.35;

    const cardSize = Math.min(heightConstraint, widthConstraint, 320);
    return Math.max(150, cardSize);
  };

  const cardSize = calculateCardSize();
  const botCardSize = Math.max(50, cardSize * 0.3);

  // Check if mobile portrait
  const isMobilePortrait = dimensions.width < 768 && dimensions.height > dimensions.width;

  // Initialize/Restart Game Logic
  const startNewGame = useCallback(() => {
    clearAllBotTimers();
    // Use hard symbols for HARD card difficulty
    const symbols = config.cardDifficulty === CardDifficulty.HARD ? SYMBOLS_HARD : undefined;
    const generatedDeck = generateDeck(7, symbols);

    // Truncate deck based on game duration setting
    const gameDuration = config.gameDuration ?? GameDuration.LONG;
    const deckSize = Math.min(gameDuration, generatedDeck.length);
    const deck = generatedDeck.slice(0, deckSize);

    // Note: Audio is started in Lobby.tsx during user gesture (required for iOS)

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
    let gameEnded = false;

    setPlayers(prevPlayers => {
      const winnerIndex = prevPlayers.findIndex(p => p.id === winnerId);
      if (winnerIndex === -1) return prevPlayers;

      const winner = prevPlayers[winnerIndex];
      const updatedPlayers = [...prevPlayers];

      // Winner's top card goes to center, remove from their stack
      const newStack = [...winner.cardStack];
      const topCard = newStack.shift();  // Remove top card

      updatedPlayers[winnerIndex] = {
        ...winner,
        cardStack: newStack
      };

      // Update center card to winner's old top card
      if (topCard) {
        setCenterCard(topCard);
      }

      // Check for game over: winner has no cards left
      if (newStack.length === 0) {
        gameEnded = true;
        endGame(winnerId);
      }

      return updatedPlayers;
    });

    // Only continue if game didn't end
    if (!gameEnded) {
      // Reset States
      setMatchedSymbolId(null);
      setGameState(GameState.PLAYING); // Resumes bot timers via useEffect
      setMessage('Match the Center Card!');
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
                  {p.cardStack.length === 0 ? 'WINNER!' : `${p.cardStack.length} cards left`}
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
    <>
      {/* Mobile Portrait Orientation Warning */}
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

      <div className={`flex flex-col h-screen bg-slate-100 overflow-hidden ${isMobilePortrait ? 'blur-sm' : ''}`}>
        {/* Top Bar: Stats */}
        <div className="bg-white shadow-sm h-12 shrink-0 px-2 md:px-4 flex justify-between items-center z-10">
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

        {/* Main Game Area */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-2 md:p-4">

          {/* Opponents (Top) */}
          <div className="flex gap-2 md:gap-4 mb-2 md:mb-4 overflow-x-auto w-full justify-center py-2">
            {bots.map(bot => (
              <div
                key={bot.id}
                className={`flex flex-col items-center transition-all duration-300 ${
                  lastWinnerId === bot.id
                    ? 'scale-110'
                    : 'opacity-70 scale-90'
                }`}
              >
                 <div className="relative">
                   {bot.cardStack.length > 0 && (
                     <Card
                       card={bot.cardStack[0]}
                       size={botCardSize}
                       layoutMode={config.cardDifficulty}
                       disabled
                       className="bg-gray-50"
                       interactive={false}
                     />
                   )}
                   <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
                     {bot.cardStack.length}
                   </div>
                 </div>
                 <span className="text-xs font-bold mt-1 text-gray-500">{bot.name}</span>
                 <span className="text-xs text-gray-400">{bot.cardStack.length} left</span>
                 {lastWinnerId === bot.id && <div className="text-xs text-green-600 font-bold animate-bounce">Got it!</div>}
              </div>
            ))}
          </div>

          {/* Center Arena */}
          <div className="flex flex-row items-center gap-4 md:gap-8 lg:gap-16 relative">

            {/* Player Hand (LEFT) */}
            <div className="relative">
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-indigo-600 font-bold tracking-widest text-xs uppercase flex items-center gap-1 whitespace-nowrap">
                  <User size={12}/> {humanPlayer?.name || 'You'}
               </div>
               {humanPlayer && humanPlayer.cardStack.length > 0 && (
                 <Card
                   card={humanPlayer.cardStack[0]}
                   size={cardSize}
                   layoutMode={config.cardDifficulty}
                   onClickSymbol={handlePlayerClick}
                   disabled={isPenaltyActive || isAnimating}
                   highlightError={isPenaltyActive}
                   className="border-indigo-500 bg-indigo-50 shadow-indigo-200 hover:scale-[1.02] transition-transform"
                   interactive={true}
                 />
               )}
               {/* Penalty Overlay */}
               {isPenaltyActive && (
                 <div className="absolute inset-0 bg-red-500/20 rounded-full z-20 flex items-center justify-center backdrop-blur-[2px] animate-pulse pointer-events-none">
                   <XCircle className="text-red-600 w-16 h-16 drop-shadow-lg" />
                 </div>
               )}
               <div className="absolute -bottom-3 -right-3 bg-indigo-600 text-white text-base font-bold w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                  {humanPlayer?.cardStack.length ?? 0}
               </div>
            </div>

            {/* The Deck / Center Card (RIGHT) */}
            <div className="relative group">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-gray-400 font-bold tracking-widest text-xs uppercase">Center</div>
               {centerCard ? (
                 <Card
                   card={centerCard}
                   size={cardSize}
                   layoutMode={config.cardDifficulty}
                   highlightSymbolId={matchedSymbolId}
                   disabled={isPenaltyActive || isAnimating}
                   className="z-10 relative"
                   interactive={false}
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
            Find the ONE symbol that matches between <strong>CENTER</strong> and <strong>YOUR</strong> card. Click it on <strong>YOUR</strong> card!
          </div>

        </div>
      </div>
    </>
  );
};

export default SinglePlayerGame;
