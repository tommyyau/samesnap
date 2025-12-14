import React, { useState, useEffect } from 'react';
import type { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { RoomPhase, SymbolItem, CardDifficulty } from '../../shared/types';
import { playMatchSound, playErrorSound, startBackgroundMusic, stopBackgroundMusic, playVictorySound } from '../../utils/sound';
import Card from '../Card';
import { Trophy, XCircle, Zap, User, Wifi, Smartphone, AlertCircle } from 'lucide-react';

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
    const opponentRowHeight = 80;
    const padding = 32;
    const availableHeight = height - topBarHeight - opponentRowHeight - padding * 2;
    const availableWidth = width - padding * 2;

    const heightConstraint = availableHeight * 0.6;
    const widthConstraint = availableWidth * 0.35;

    const cardSize = Math.min(heightConstraint, widthConstraint, 320);
    return Math.max(150, cardSize);
  };

  // Check if mobile portrait
  const isMobilePortrait = dimensions.width < 768 && dimensions.height > dimensions.width;

  // Start/stop background music
  useEffect(() => {
    if (roomState?.phase === RoomPhase.PLAYING) {
      startBackgroundMusic();
    }
    return () => stopBackgroundMusic();
  }, [roomState?.phase]);

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

  // Reset hasClickedPlayAgain when we leave GAME_OVER phase (room was reset)
  useEffect(() => {
    if (roomState?.phase !== RoomPhase.GAME_OVER) {
      setHasClickedPlayAgain(false);
      setVictoryCelebrationShown(false);
      setShowVictoryCelebration(false);
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
                    {p.cardsRemaining === 0 ? 'WINNER!' : `${p.cardsRemaining} cards left`}
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
                Play Again
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

      {/* Mobile Portrait Orientation Warning */}
      {isMobilePortrait && (
        <div className="fixed inset-0 z-[60] bg-indigo-900 text-white flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
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

      <div className={`flex flex-col h-screen bg-slate-100 overflow-hidden relative ${isMobilePortrait ? 'blur-sm' : ''}`}>
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

      {/* Top Bar */}
      <div className="bg-white shadow-sm p-2 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <button onClick={handleExit} className="text-slate-500 hover:text-red-600 font-bold text-sm px-3 py-1 rounded hover:bg-slate-100">
            EXIT
          </button>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Wifi size={12} /> {latency}ms
          </div>
        </div>

        <div className={`px-3 py-1 rounded-lg flex items-center gap-2 ${isPenaltyActive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
          {isPenaltyActive ? <XCircle size={16}/> : <Zap size={16}/>}
          <span className="font-bold text-sm">{isPenaltyActive ? `WAIT ${penaltyTimeLeft}s` : 'READY'}</span>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4">

        {/* Opponents (Top) */}
        <div className="flex gap-4 mb-4 overflow-x-auto w-full justify-center py-2">
          {opponents.map(player => (
            <div key={player.id} className={`flex flex-col items-center transition-all ${roomState.roundWinnerId === player.id ? 'scale-110' : 'opacity-80'}`}>
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500 border-4 border-white shadow">
                  {player.name[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                  {player.cardsRemaining}
                </div>
              </div>
              <span className="text-xs font-bold mt-1 text-gray-500">{player.name}</span>
              <span className="text-xs text-gray-400">{player.cardsRemaining} left</span>
              {roomState.roundWinnerId === player.id && <div className="text-xs text-green-600 font-bold">Got it!</div>}
            </div>
          ))}
        </div>

        {/* Center Arena */}
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">

          {/* Your Card */}
          <div className="relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-indigo-600 font-bold tracking-widest text-sm uppercase flex items-center gap-1">
              <User size={14}/> {you?.name || 'You'}
            </div>
            {roomState.yourCard && (
              <Card
                card={roomState.yourCard}
                size={cardSize}
                layoutMode={roomState.config?.cardDifficulty || CardDifficulty.EASY}
                onClickSymbol={handleSymbolClick}
                disabled={isPenaltyActive || isAnimating}
                highlightError={isPenaltyActive}
                highlightSymbolId={isAnimating ? roomState.roundMatchedSymbolId : null}
                className="border-indigo-500 bg-indigo-50 shadow-indigo-200"
                interactive={true}
              />
            )}
            {isPenaltyActive && (
              <div className="absolute inset-0 bg-red-500/20 rounded-full z-20 flex items-center justify-center backdrop-blur-[2px] animate-pulse pointer-events-none">
                <XCircle className="text-red-600 w-16 h-16" />
              </div>
            )}
            <div className="absolute -bottom-4 -right-4 bg-indigo-600 text-white text-lg font-bold w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              {you?.cardsRemaining ?? 0}
            </div>
          </div>

          {/* Center Card */}
          <div className="relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-gray-400 font-bold tracking-widest text-sm uppercase">
              Center
            </div>
            {roomState.centerCard && (
              <Card
                card={roomState.centerCard}
                size={cardSize}
                layoutMode={roomState.config?.cardDifficulty || CardDifficulty.EASY}
                highlightSymbolId={isAnimating ? roomState.roundMatchedSymbolId : null}
                disabled={true}
                interactive={false}
              />
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-500 text-sm hidden md:block">
          Find the ONE symbol that matches between CENTER and YOUR card. Click it on YOUR card!
        </div>
      </div>
      </div>
    </>
  );
};

export default MultiplayerGame;
