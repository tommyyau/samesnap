import React, { useState, useEffect, useRef } from 'react';
import type { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { RoomPhase, SymbolItem, CardLayout, RecordGamePayload } from '../../shared/types';
import { playMatchSound, playErrorSound, startBackgroundMusic, stopBackgroundMusic, playVictorySound, unlockAudio } from '../../utils/sound';
import { getCardSetById } from '../../shared/cardSets';
import Card from '../Card';
import { Trophy, XCircle, Zap, Wifi, AlertCircle } from 'lucide-react';
import { SignedIn, UserButton } from '@clerk/clerk-react';
import { useUserStats } from '../../hooks/useUserStats';

interface MultiplayerGameProps {
  roomCode: string;
  playerName: string;
  onExit: () => void;
  multiplayerHook: ReturnType<typeof useMultiplayerGame>;
}

const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ onExit, multiplayerHook }) => {
  const { roomState, latency, connectionError, attemptMatch, leaveRoom, playAgain, clearError } = multiplayerHook;

  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState(0);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [rejoinTimeLeft, setRejoinTimeLeft] = useState(0);
  const [hasClickedPlayAgain, setHasClickedPlayAgain] = useState(false);
  const [showVictoryCelebration, setShowVictoryCelebration] = useState(false);
  const [victoryCelebrationShown, setVictoryCelebrationShown] = useState(false);

  // Game stats tracking
  const gameStartTimeRef = useRef<number | null>(null);
  const statsRecordedRef = useRef(false);
  const { recordGameResult } = useUserStats();

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
    const opponentRowHeight = isMobile ? 48 : 90;  // Tiny opponent indicators on mobile (extra space for badges)
    const padding = isMobile ? 4 : 32;  // Less edge padding on mobile
    const cardGap = isMobile ? 16 : 32;  // More gap between cards for breathing room

    const availableHeight = height - topBarHeight - opponentRowHeight - padding * 2;
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

  // Start/stop background music and track game start time
  useEffect(() => {
    if (roomState?.phase === RoomPhase.PLAYING) {
      startBackgroundMusic();
      // Track game start time for stats
      if (gameStartTimeRef.current === null) {
        gameStartTimeRef.current = Date.now();
      }
    }
    return () => stopBackgroundMusic();
  }, [roomState?.phase]);

  // Record game stats when game ends
  useEffect(() => {
    if (roomState?.phase === RoomPhase.GAME_OVER && !statsRecordedRef.current && gameStartTimeRef.current !== null) {
      statsRecordedRef.current = true;

      const you = roomState.players.find(p => p.isYou);
      if (!you) return;

      // You win if you have 0 cards OR you're the last player standing
      const isWin = you.cardsRemaining === 0 ||
        (roomState.gameEndReason === 'last_player_standing' && roomState.players.filter(p => p.cardsRemaining > 0).length <= 1 && you.cardsRemaining > 0);

      const gameDurationMs = Date.now() - gameStartTimeRef.current;
      const builtInSet = roomState.config?.cardSetId ? getCardSetById(roomState.config.cardSetId) : undefined;
      const cardSetName = roomState.config?.customSetName || builtInSet?.name || roomState.config?.cardSetId || 'default';

      const payload: RecordGamePayload = {
        mode: 'multiplayer',
        isWin,
        winReason: roomState.gameEndReason,
        gameDurationMs,
        context: {
          cardLayout: roomState.config?.cardLayout || CardLayout.ORDERLY,
          cardSetId: roomState.config?.cardSetId || 'default',
          cardSetName,
          playerCount: roomState.players.length,
        },
      };

      recordGameResult(payload);
    }
  }, [roomState?.phase, roomState?.players, roomState?.gameEndReason, roomState?.config, recordGameResult]);

  // Play sounds on round winner
  useEffect(() => {
    if (roomState?.phase === RoomPhase.ROUND_END && roomState.roundWinnerId) {
      const isYouWinner = roomState.players.find(p => p.isYou)?.id === roomState.roundWinnerId;
      playMatchSound(-1, isYouWinner);
    }
  }, [roomState?.phase, roomState?.roundWinnerId, roomState?.players]);

  // Penalty countdown
  useEffect(() => {
    if (roomState?.penaltyUntil && roomState.penaltyUntil > Date.now()) {
      playErrorSound();
      const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((roomState.penaltyUntil! - Date.now()) / 1000));
        setPenaltyTimeLeft(left);
        if (left <= 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setPenaltyTimeLeft(0);
    }
  }, [roomState?.penaltyUntil]);

  // Rejoin window countdown
  useEffect(() => {
    if (roomState?.rejoinWindowEndsAt && roomState.rejoinWindowEndsAt > Date.now()) {
      const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((roomState.rejoinWindowEndsAt! - Date.now()) / 1000));
        setRejoinTimeLeft(left);
        if (left <= 0) clearInterval(interval);
      }, 100);
      setRejoinTimeLeft(Math.ceil((roomState.rejoinWindowEndsAt - Date.now()) / 1000));
      return () => clearInterval(interval);
    } else {
      setRejoinTimeLeft(0);
    }
  }, [roomState?.rejoinWindowEndsAt]);

  // Reset state when we leave GAME_OVER phase (room was reset)
  useEffect(() => {
    if (roomState?.phase !== RoomPhase.GAME_OVER) {
      setHasClickedPlayAgain(false);
      setVictoryCelebrationShown(false);
      setShowVictoryCelebration(false);
      // Reset stats tracking for next game
      gameStartTimeRef.current = null;
      statsRecordedRef.current = false;
    }
  }, [roomState?.phase]);

  // Victory celebration when game ends
  useEffect(() => {
    if (roomState?.phase === RoomPhase.GAME_OVER && !victoryCelebrationShown) {
      setVictoryCelebrationShown(true);
      setShowVictoryCelebration(true);
      stopBackgroundMusic();
      playVictorySound();

      // Hide celebration after 3 seconds to show scoreboard
      setTimeout(() => {
        setShowVictoryCelebration(false);
      }, 3000);
    }
  }, [roomState?.phase, victoryCelebrationShown]);

  const handleSymbolClick = (symbol: SymbolItem) => {
    if (roomState?.phase !== RoomPhase.PLAYING) return;
    if (roomState.penaltyUntil && Date.now() < roomState.penaltyUntil) return;
    // Unlock audio on first click (Safari requires user gesture)
    unlockAudio();
    attemptMatch(symbol.id);
  };

  const handleExit = () => {
    stopBackgroundMusic();
    leaveRoom();
    onExit();
  };

  const handlePlayAgain = () => {
    setHasClickedPlayAgain(true);
    playAgain();
  };

  if (!roomState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-xl font-bold text-gray-500">Connecting...</div>
      </div>
    );
  }

  // Wait for complete game state before showing game UI
  const isWaitingForGameState = roomState.phase === RoomPhase.PLAYING &&
    (!roomState.yourCard || !roomState.centerCard);
  if (isWaitingForGameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-xl font-bold text-gray-500">Loading game...</div>
      </div>
    );
  }

  // Countdown screen
  if (roomState.phase === RoomPhase.COUNTDOWN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white">
        <div className="text-9xl font-black animate-pulse">{roomState.countdown}</div>
        <div className="text-2xl mt-4">Get Ready!</div>
      </div>
    );
  }

  // Victory celebration screen with floating confetti
  if (roomState.phase === RoomPhase.GAME_OVER && showVictoryCelebration) {
    const sortedPlayers = [...roomState.players].sort((a, b) => a.cardsRemaining - b.cardsRemaining);
    const winner = sortedPlayers[0];
    const isYouWinner = winner?.isYou;
    const confettiEmojis = ['🎉', '🎊', '🎈', '⭐', '✨', '🌟', '🏆'];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-hidden">
        {/* Winner text */}
        <div className="text-center z-10">
          <div className="text-5xl md:text-7xl font-black text-white drop-shadow-lg mb-4 animate-bounce">
            {isYouWinner ? 'YOU WIN!' : `${winner?.name} WINS!`}
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

  // Game Over screen
  if (roomState.phase === RoomPhase.GAME_OVER) {
    // Sort by cards remaining ascending (0 = winner)
    const sortedPlayers = [...roomState.players].sort((a, b) => a.cardsRemaining - b.cardsRemaining);
    const winner = sortedPlayers[0];
    const isYouWinner = winner?.isYou;
    const isLastPlayerStanding = roomState.gameEndReason === 'last_player_standing';
    const playersWantingRematch = roomState.playersWantRematch || [];
    const you = roomState.players.find(p => p.isYou);
    const youWantRematch = you && playersWantingRematch.includes(you.id);
    const canPlayAgain = rejoinTimeLeft > 0 && !hasClickedPlayAgain && !youWantRematch;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white p-4">
        <div className="bg-white text-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center">
          <Trophy className={`w-24 h-24 mx-auto mb-4 ${isYouWinner ? 'text-yellow-400' : 'text-gray-400'}`} />

          {isLastPlayerStanding && isYouWinner ? (
            <>
              <h2 className="text-4xl font-bold mb-2">Last One Standing!</h2>
              <p className="text-gray-500 mb-6">Everyone else left - You win!</p>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-bold mb-2">{isYouWinner ? 'You Won!' : `${winner?.name} Wins!`}</h2>
              <p className="text-gray-500 mb-6">Final Standings</p>
            </>
          )}

          <div className="space-y-3 mb-6">
            {sortedPlayers.map((p, idx) => {
              const wantsRematch = playersWantingRematch.includes(p.id);
              return (
                <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl font-bold ${p.isYou ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-6">#{idx + 1}</span>
                    <span>{p.name}</span>
                    {p.isYou && <span className="text-xs text-indigo-500">(You)</span>}
                    {wantsRematch && <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Ready</span>}
                  </div>
                  <span className={p.cardsRemaining === 0 ? 'text-green-600' : 'text-indigo-600'}>
                    {p.cardsRemaining === 0 ? 'WINNER!' : p.cardsRemaining}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rejoin window status */}
          {rejoinTimeLeft > 0 && (
            <div className="mb-4 text-sm text-gray-500">
              {playersWantingRematch.length > 0 ? (
                <span>{playersWantingRematch.length} player(s) ready for rematch</span>
              ) : (
                <span>Rematch window: {rejoinTimeLeft}s</span>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            {canPlayAgain && (
              <button
                onClick={handlePlayAgain}
                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition"
              >
                Rejoin Room
              </button>
            )}
            {(hasClickedPlayAgain || youWantRematch) && rejoinTimeLeft > 0 && (
              <button
                disabled
                className="px-6 py-3 rounded-xl bg-gray-400 text-white font-bold cursor-not-allowed"
              >
                Waiting for others... ({rejoinTimeLeft}s)
              </button>
            )}
            <button onClick={handleExit} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  const you = roomState.players.find(p => p.isYou);
  const opponents = roomState.players.filter(p => !p.isYou);
  const isPenaltyActive = penaltyTimeLeft > 0;
  const isAnimating = roomState.phase === RoomPhase.ROUND_END;
  const cardSize = calculateCardSize();
  const isYouWinner = isAnimating && you?.id === roomState.roundWinnerId;
  const isOpponentWinner = isAnimating && !isYouWinner && roomState.roundWinnerId;

  const handleErrorRetry = () => {
    clearError();
    // Socket will automatically reconnect
  };

  const handleErrorExit = () => {
    clearError();
    leaveRoom();
    onExit();
  };

  return (
    <>
      {/* Connection Error Modal */}
      {connectionError && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-red-500 mb-4">
              <AlertCircle size={48} className="mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Connection Lost</h3>
            <p className="text-gray-600 mb-6">{connectionError}</p>
            <div className="flex gap-3">
              <button
                onClick={handleErrorExit}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Exit Game
              </button>
              <button
                onClick={handleErrorRetry}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-all"
              >
                Reconnect
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-screen bg-slate-100 overflow-hidden relative safe-all">
        {/* WIN/LOSE OVERLAY */}
      {isAnimating && (
        <div className={`absolute inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
          isYouWinner ? 'bg-green-500/90' : 'bg-slate-900/70'
        }`}>
          {isYouWinner ? (
            // YOU WON - Big celebration
            <div className="text-center animate-bounce">
              <div className="text-6xl font-black text-white drop-shadow-lg">YOU GOT IT!</div>
            </div>
          ) : (
            // OPPONENT WON - Smaller notification
            <div className="text-center">
              <div className="text-6xl mb-4">😮</div>
              <div className="text-4xl font-black text-white drop-shadow-lg">
                {roomState.roundWinnerName} got it!
              </div>
              <div className="text-xl text-gray-300 mt-4">Be faster next time...</div>
            </div>
          )}
        </div>
      )}

      {/* Top Bar - tighter on mobile */}
      <div className="bg-white shadow-sm h-10 sm:h-12 px-2 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <button onClick={handleExit} className="text-slate-500 hover:text-red-600 font-bold text-sm px-3 py-1 rounded hover:bg-slate-100">
            EXIT
          </button>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Wifi size={12} /> {latency}ms
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-lg flex items-center gap-2 ${isPenaltyActive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
            {isPenaltyActive ? <XCircle size={16}/> : <Zap size={16}/>}
            <span className="font-bold text-sm">{isPenaltyActive ? `WAIT ${penaltyTimeLeft}s` : 'READY'}</span>
          </div>
          <SignedIn>
            <UserButton appearance={{ elements: { avatarBox: 'w-6 h-6' } }} />
          </SignedIn>
        </div>
      </div>

      {/* Main Game Area - tighter mobile spacing */}
      <div className="flex-1 relative flex flex-col items-center p-2 sm:p-4">

        {/* Opponents (Top) - tiny indicators on mobile */}
        <div className="flex gap-0.5 sm:gap-4 w-full justify-center min-h-[48px] sm:min-h-[90px] shrink-0 items-start pt-0.5 z-20 relative overflow-visible">
          {opponents.map(player => (
            <div key={player.id} className={`flex flex-col items-center transition-all ${roomState.roundWinnerId === player.id ? 'scale-110' : 'opacity-80'}`}>
              <div className="relative">
                <div className="w-7 h-7 sm:w-16 sm:h-16 rounded-full bg-gray-200 flex items-center justify-center text-sm sm:text-2xl font-bold text-gray-500 border sm:border-4 border-white shadow">
                  {player.name[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 bg-indigo-600 text-white text-[8px] sm:text-xs font-bold w-3.5 h-3.5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border border-white z-30">
                  {player.cardsRemaining}
                </div>
              </div>
              <span className="text-[8px] sm:text-xs font-bold mt-0.5 text-gray-500 truncate max-w-[40px] sm:max-w-none">{player.name}</span>
              {roomState.roundWinnerId === player.id && <div className="text-[8px] sm:text-xs text-green-600 font-bold">Got it!</div>}
            </div>
          ))}
        </div>

        {/* Center Arena - evenly spaced on mobile, centered on desktop */}
        <div className="flex-1 flex flex-col md:flex-row items-center justify-evenly md:justify-center gap-4 sm:gap-6 md:gap-16 w-full max-w-6xl">

          {/* Your Card */}
          <div className="relative">
            {roomState.yourCard && (
              <Card
                card={roomState.yourCard}
                size={cardSize}
                layoutMode={roomState.config?.cardLayout || CardLayout.ORDERLY}
                onClickSymbol={handleSymbolClick}
                disabled={isPenaltyActive || isAnimating}
                highlightError={isPenaltyActive}
                highlightSymbolId={isAnimating ? roomState.roundMatchedSymbolId : null}
                className="border-indigo-500 bg-indigo-50 shadow-indigo-200"
                interactive={true}
                label={you?.name || 'You'}
              />
            )}
            {isPenaltyActive && (
              <div className="absolute inset-0 bg-red-500/20 rounded-full z-20 flex items-center justify-center backdrop-blur-[2px] animate-pulse pointer-events-none">
                <XCircle className="text-red-600 w-16 h-16" />
              </div>
            )}
            <div className="absolute bottom-[12%] right-[3%] bg-indigo-600 text-white text-lg font-bold w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10">
              {you?.cardsRemaining ?? 0}
            </div>
          </div>

          {/* Snap Card */}
          <div className="relative">
            {roomState.centerCard && (
              <Card
                card={roomState.centerCard}
                size={cardSize}
                layoutMode={roomState.config?.cardLayout || CardLayout.ORDERLY}
                highlightSymbolId={isAnimating ? roomState.roundMatchedSymbolId : null}
                disabled={true}
                interactive={false}
                label="Snap Card"
              />
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-4 sm:mt-8 text-center text-gray-500 text-sm hidden md:block">
          Find the ONE symbol that matches between <strong>SNAP CARD</strong> and <strong>YOUR</strong> card. Click it on <strong>YOUR</strong> card!
        </div>
      </div>
      </div>
    </>
  );
};

export default MultiplayerGame;
