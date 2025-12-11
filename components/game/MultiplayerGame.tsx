import React, { useState, useEffect } from 'react';
import { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { RoomPhase, SymbolItem, CardDifficulty } from '../../shared/types';
import { playMatchSound, playErrorSound, startBackgroundMusic, stopBackgroundMusic } from '../../utils/sound';
import Card from '../Card';
import { Trophy, XCircle, Zap, User, Wifi } from 'lucide-react';

interface MultiplayerGameProps {
  roomCode: string;
  playerName: string;
  onExit: () => void;
}

const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ roomCode, playerName, onExit }) => {
  const { roomState, isConnected, latency, attemptMatch, leaveRoom } = useMultiplayerGame({
    roomCode,
    playerName,
    onError: (err) => console.error(err),
    onKicked: onExit,
  });

  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState(0);

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

  if (!roomState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-xl font-bold text-gray-500">Connecting...</div>
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

  // Game Over screen
  if (roomState.phase === RoomPhase.GAME_OVER) {
    const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const isYouWinner = winner?.isYou;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white p-4">
        <div className="bg-white text-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center">
          <Trophy className={`w-24 h-24 mx-auto mb-4 ${isYouWinner ? 'text-yellow-400' : 'text-gray-400'}`} />
          <h2 className="text-4xl font-bold mb-2">{isYouWinner ? 'You Won!' : `${winner?.name} Wins!`}</h2>
          <p className="text-gray-500 mb-6">Final Scores</p>

          <div className="space-y-3 mb-8">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl font-bold ${p.isYou ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-6">#{idx + 1}</span>
                  <span>{p.name}</span>
                  {p.isYou && <span className="text-xs text-indigo-500">(You)</span>}
                </div>
                <span className="text-indigo-600">{p.score} cards</span>
              </div>
            ))}
          </div>

          <button onClick={handleExit} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const you = roomState.players.find(p => p.isYou);
  const opponents = roomState.players.filter(p => !p.isYou);
  const isPenaltyActive = penaltyTimeLeft > 0;
  const isAnimating = roomState.phase === RoomPhase.ROUND_END;
  const cardSize = window.innerWidth < 768 ? 200 : 320;

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white shadow-sm p-2 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <button onClick={handleExit} className="text-slate-500 hover:text-red-600 font-bold text-sm px-3 py-1 rounded hover:bg-slate-100">
            EXIT
          </button>
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg">
            <span className="text-xs text-gray-500 uppercase font-bold">Cards Left</span>
            <span className="font-bold text-indigo-700">{roomState.deckRemaining}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Wifi size={12} /> {latency}ms
          </div>
        </div>

        {/* Round Winner Message */}
        {isAnimating && roomState.roundWinnerName && (
          <div className="font-bold text-lg text-green-600 animate-pulse">
            {roomState.roundWinnerName} found the match!
          </div>
        )}

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
                  {player.score}
                </div>
              </div>
              <span className="text-xs font-bold mt-1 text-gray-500">{player.name}</span>
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
              {you?.score || 0}
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
  );
};

export default MultiplayerGame;
