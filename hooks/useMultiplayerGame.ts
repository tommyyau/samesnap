import { useState, useEffect, useCallback, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import { ClientRoomState, RoomPhase, MultiplayerGameConfig } from '../shared/types';
import { ClientMessage, ServerMessage } from '../shared/protocol';

declare const process: {
  env: {
    PARTYKIT_HOST?: string;
  };
};

interface UseMultiplayerGameOptions {
  roomCode: string;
  playerName: string;
  onError?: (error: { code: string; message: string }) => void;
  onKicked?: () => void;
}

export function useMultiplayerGame({ roomCode, playerName, onError, onKicked }: UseMultiplayerGameOptions) {
  const [roomState, setRoomState] = useState<ClientRoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [latency, setLatency] = useState<number>(0);
  const pingInterval = useRef<ReturnType<typeof setInterval>>();
  const reconnectData = useRef<{ roomCode: string; playerId: string } | null>(null);
  const hasJoined = useRef(false);

  const host = process.env.PARTYKIT_HOST || 'localhost:1999';

  const socket = usePartySocket({
    host,
    room: roomCode,
    query: reconnectData.current ? { reconnectId: reconnectData.current.playerId } : undefined,
    onOpen: () => {
      setIsConnected(true);
      if (!hasJoined.current) {
        hasJoined.current = true;
        socket.send(JSON.stringify({ type: 'join', payload: { playerName } } as ClientMessage));
      }
      pingInterval.current = setInterval(() => {
        socket.send(JSON.stringify({ type: 'ping', payload: { timestamp: Date.now() } } as ClientMessage));
      }, 5000);
    },
    onClose: () => {
      setIsConnected(false);
      if (pingInterval.current) clearInterval(pingInterval.current);
    },
    onMessage: (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      handleServerMessage(message);
    },
  });

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }, [socket]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'room_state':
        setRoomState(message.payload);
        // Store reconnect data
        const me = message.payload.players.find(p => p.isYou);
        if (me) {
          reconnectData.current = { roomCode, playerId: me.id };
          setIsHost(me.isHost);
        }
        break;

      case 'you_are_host':
        setIsHost(true);
        break;

      case 'player_joined':
        setRoomState(prev => prev ? {
          ...prev,
          players: [...prev.players.filter(p => p.id !== message.payload.player.id), message.payload.player]
        } : null);
        break;

      case 'player_left':
        setRoomState(prev => {
          if (!prev) return null;
          const leavingPlayer = prev.players.find(p => p.id === message.payload.playerId);
          if (leavingPlayer?.isYou) {
            onKicked?.();
          }
          return {
            ...prev,
            players: prev.players.filter(p => p.id !== message.payload.playerId)
          };
        });
        break;

      case 'player_disconnected':
        setRoomState(prev => prev ? {
          ...prev,
          players: prev.players.map(p =>
            p.id === message.payload.playerId ? { ...p, status: 'disconnected' as const } : p
          )
        } : null);
        break;

      case 'player_reconnected':
        setRoomState(prev => prev ? {
          ...prev,
          players: prev.players.map(p =>
            p.id === message.payload.playerId ? { ...p, status: 'connected' as const } : p
          )
        } : null);
        break;

      case 'countdown':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.COUNTDOWN,
          countdown: message.payload.seconds
        } : null);
        break;

      case 'round_start':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.PLAYING,
          centerCard: message.payload.centerCard,
          yourCard: message.payload.yourCard,
          roundNumber: message.payload.roundNumber,
          roundWinnerId: null,
          roundMatchedSymbolId: null,
        } : null);
        break;

      case 'round_winner':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.ROUND_END,
          roundWinnerId: message.payload.winnerId,
          roundWinnerName: message.payload.winnerName,
          roundMatchedSymbolId: message.payload.matchedSymbolId,
          players: prev.players.map(p =>
            p.id === message.payload.winnerId ? { ...p, score: p.score + 1 } : p
          )
        } : null);
        break;

      case 'penalty':
        setRoomState(prev => prev ? {
          ...prev,
          penaltyUntil: message.payload.until
        } : null);
        break;

      case 'game_over':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.GAME_OVER,
          players: message.payload.finalScores.map(s => {
            const existingPlayer = prev.players.find(p => p.id === s.playerId);
            return existingPlayer ? { ...existingPlayer, score: s.score } : {
              id: s.playerId,
              name: s.name,
              status: 'connected' as const,
              score: s.score,
              hasCard: false,
              isHost: false,
              isYou: false
            };
          })
        } : null);
        break;

      case 'pong':
        setLatency(Date.now() - message.payload.clientTimestamp);
        break;

      case 'error':
        onError?.(message.payload);
        break;
    }
  }, [roomCode, onError, onKicked]);

  const attemptMatch = useCallback((symbolId: number) => {
    sendMessage({
      type: 'match_attempt',
      payload: { symbolId, clientTimestamp: Date.now() }
    });
  }, [sendMessage]);

  const startGame = useCallback((config: MultiplayerGameConfig) => {
    sendMessage({ type: 'start_game', payload: { config } });
  }, [sendMessage]);

  const leaveRoom = useCallback(() => {
    sendMessage({ type: 'leave', payload: {} });
    socket.close();
  }, [sendMessage, socket]);

  const kickPlayer = useCallback((playerId: string) => {
    sendMessage({ type: 'kick_player', payload: { playerId } });
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      if (pingInterval.current) clearInterval(pingInterval.current);
    };
  }, []);

  return {
    roomState,
    isConnected,
    isHost,
    latency,
    attemptMatch,
    startGame,
    leaveRoom,
    kickPlayer,
  };
}

// Room code utilities
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
