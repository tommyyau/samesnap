import React, { useState, useEffect, useRef } from 'react';
import type { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { RoomPhase, SymbolItem, CardLayout, RecordGamePayload } from '../../shared/types';
import { getCardSetById } from '../../shared/cardSets';
import Card from '../Card';
import { XCircle, Zap, Wifi } from 'lucide-react';
import { ConnectionErrorModal } from '../common/ConnectionErrorModal';
import { SignedIn, UserButton } from '@clerk/clerk-react';
import { useUserStats, hasShownSignInPrompt, markSignInPromptShown } from '../../hooks/useUserStats';
import { Toast } from '../common/Toast';
import { useResponsiveCardSize } from '../../hooks/useResponsiveCardSize';
import { useGameAudio } from '../../hooks/useGameAudio';
import { VictoryCelebration } from '../common/VictoryCelebration';
import { GameOverScoreboard, PlayerScore } from '../common/GameOverScoreboard';

interface MultiplayerGameProps {
  roomCode: string;
  playerName: string;
  onExit: () => void;
  multiplayerHook: ReturnType<typeof useMultiplayerGame>;
}

const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ onExit, multiplayerHook }) => {
  const { roomState, latency, connectionError, attemptMatch, leaveRoom, playAgain, clearError } = multiplayerHook;

  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState(0);
  const [rejoinTimeLeft, setRejoinTimeLeft] = useState(0);
  const [hasClickedPlayAgain, setHasClickedPlayAgain] = useState(false);
  const [showVictoryCelebration, setShowVictoryCelebration] = useState(false);
  const [victoryCelebrationShown, setVictoryCelebrationShown] = useState(false);
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null);

  // Responsive sizing - opponent row is taller than single-player bot row
  const { cardSize } = useResponsiveCardSize({
    bottomRowHeight: { mobile: 48, desktop: 90 },
  });

  // Game stats tracking
  const gameStartTimeRef = useRef<number | null>(null);
  const statsRecordedRef = useRef(false);
  const { recordGameResult } = useUserStats();

  // Audio management - auto-starts music when playing, stops on game over
  const isPlayingPhase = roomState?.phase === RoomPhase.PLAYING;
  const isGameOverPhase = roomState?.phase === RoomPhase.GAME_OVER;
  const { playMatch, playError, playVictory, unlockAudio, stopMusic } = useGameAudio({
    isPlaying: isPlayingPhase || false,
    isGameOver: isGameOverPhase || false,
  });

  // Track game start time when game starts
  // Note: Background music is auto-managed by useGameAudio hook
  useEffect(() => {
    if (roomState?.phase === RoomPhase.PLAYING && gameStartTimeRef.current === null) {
      gameStartTimeRef.current = Date.now();
    }
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

      // Record game and show appropriate toast
      recordGameResult(payload).then(result => {
        if (result.isPersonalBest) {
          setToast({ message: 'New Record!', icon: '🔥' });
        } else if (!result.recorded && !hasShownSignInPrompt()) {
          markSignInPromptShown();
          setToast({ message: 'Sign in to save your progress' });
        }
      });
    }
  }, [roomState?.phase, roomState?.players, roomState?.gameEndReason, roomState?.config, recordGameResult]);

  // Play sounds on round winner
  useEffect(() => {
    if (roomState?.phase === RoomPhase.ROUND_END && roomState.roundWinnerId) {
      const isYouWinner = roomState.players.find(p => p.isYou)?.id === roomState.roundWinnerId;
      playMatch(-1, isYouWinner);
    }
  }, [roomState?.phase, roomState?.roundWinnerId, roomState?.players, playMatch]);

  // Penalty countdown
  useEffect(() => {
    if (roomState?.penaltyUntil && roomState.penaltyUntil > Date.now()) {
      playError();
      const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((roomState.penaltyUntil! - Date.now()) / 1000));
        setPenaltyTimeLeft(left);
        if (left <= 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setPenaltyTimeLeft(0);
    }
  }, [roomState?.penaltyUntil, playError]);

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
      setToast(null);
      // Reset stats tracking for next game
      gameStartTimeRef.current = null;
      statsRecordedRef.current = false;
    }
  }, [roomState?.phase]);

  // Victory celebration when game ends
  // Note: Music is auto-stopped by useGameAudio when isGameOver becomes true
  useEffect(() => {
    if (roomState?.phase === RoomPhase.GAME_OVER && !victoryCelebrationShown) {
      setVictoryCelebrationShown(true);
      setShowVictoryCelebration(true);
      playVictory();

      // Hide celebration after 3 seconds to show scoreboard
      setTimeout(() => {
        setShowVictoryCelebration(false);
      }, 3000);
    }
  }, [roomState?.phase, victoryCelebrationShown, playVictory]);

  const handleSymbolClick = (symbol: SymbolItem) => {
    if (roomState?.phase !== RoomPhase.PLAYING) return;
    if (roomState.penaltyUntil && Date.now() < roomState.penaltyUntil) return;
    // Unlock audio on first click (Safari requires user gesture)
    unlockAudio();
    attemptMatch(symbol.id);
  };

  const handleExit = () => {
    stopMusic();
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

    return (
      <VictoryCelebration
        winnerName={winner?.name || 'Unknown'}
        isPlayerWinner={isYouWinner || false}
      />
    );
  }

  // Game Over screen
  if (roomState.phase === RoomPhase.GAME_OVER) {
    // Sort by cards remaining ascending (0 = winner)
    const sortedPlayers = [...roomState.players].sort((a, b) => a.cardsRemaining - b.cardsRemaining);
    const winner = sortedPlayers[0];
    const isYouWinner = winner?.isYou || false;
    const isLastPlayerStanding = roomState.gameEndReason === 'last_player_standing';
    const playersWantingRematch = roomState.playersWantRematch || [];
    const you = roomState.players.find(p => p.isYou);
    const youWantRematch = you && playersWantingRematch.includes(you.id);
    const canPlayAgain = rejoinTimeLeft > 0 && !hasClickedPlayAgain && !youWantRematch;

    // Convert to PlayerScore format for the shared component
    const playerScores: PlayerScore[] = sortedPlayers.map(p => ({
      id: p.id,
      name: p.name,
      cardsRemaining: p.cardsRemaining,
      isYou: p.isYou,
      wantsRematch: playersWantingRematch.includes(p.id),
    }));

    return (
      <>
        <GameOverScoreboard
          players={playerScores}
          isPlayerWinner={isYouWinner}
          winnerName={winner?.name || 'Unknown'}
          onPlayAgain={handlePlayAgain}
          onExit={handleExit}
          variant="multiplayer"
          isLastPlayerStanding={isLastPlayerStanding}
          rejoinTimeLeft={rejoinTimeLeft}
          playersWantingRematchCount={playersWantingRematch.length}
          canPlayAgain={canPlayAgain}
          waitingForOthers={hasClickedPlayAgain || !!youWantRematch}
          playAgainLabel="Rejoin Room"
          exitLabel="Back to Lobby"
        />
        {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      </>
    );
  }

  const you = roomState.players.find(p => p.isYou);
  const opponents = roomState.players.filter(p => !p.isYou);
  const isPenaltyActive = penaltyTimeLeft > 0;
  const isAnimating = roomState.phase === RoomPhase.ROUND_END;
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
        <ConnectionErrorModal
          error={connectionError}
          onRetry={handleErrorRetry}
          onLeave={handleErrorExit}
          retryLabel="Reconnect"
          leaveLabel="Exit Game"
        />
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
