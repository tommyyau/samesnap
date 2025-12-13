import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  onRoomExpired?: (reason: string) => void;
  onSoloRejoinBoot?: (message: string) => void;
}

export function useMultiplayerGame({ roomCode, playerName, onError, onKicked, onRoomExpired, onSoloRejoinBoot }: UseMultiplayerGameOptions) {
  const [roomState, setRoomState] = useState<ClientRoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [latency, setLatency] = useState<number>(0);
  const [hasReceivedRoomState, setHasReceivedRoomState] = useState(false);
  const pingInterval = useRef<ReturnType<typeof setInterval>>();
  const hasJoined = useRef(false);
  // Store countdown value if it arrives before room_state
  const pendingCountdown = useRef<number | null>(null);
  const storageKey = useMemo(() => `samesnap-player-${roomCode}`, [roomCode]);
  // Track reconnection state to avoid race conditions
  const reconnectPending = useRef(false);
  const fallbackJoinSent = useRef(false);
  const originalReconnectId = useRef<string | null>(null);

  // Read the initial playerId from localStorage for reconnection
  const initialPlayerId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, [storageKey]);
  const playerIdRef = useRef<string | null>(initialPlayerId);

  const persistPlayerId = useCallback((value: string | null) => {
    if (typeof window === 'undefined') return;
    playerIdRef.current = value;
    try {
      if (value) {
        window.localStorage.setItem(storageKey, value);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);
  const clearStoredPlayerId = useCallback(() => {
    persistPlayerId(null);
  }, [persistPlayerId]);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const host = process.env.PARTYKIT_HOST || 'localhost:1999';
  // roomPath is stable - just the room code. Reconnection is handled via message protocol,
  // not URL params, so mid-session reconnects work correctly.
  const roomPath = roomCode;

  const socket = usePartySocket({
    host,
    room: roomPath,
    onOpen: () => {
      setIsConnected(true);
      const sendJoin = () => {
        // Don't send join if we already have a confirmed session
        if (hasJoined.current) return;
        // Mark that we've sent a fallback join (but don't set hasJoined until room_state confirms)
        fallbackJoinSent.current = true;
        socket.send(JSON.stringify({ type: 'join', payload: { playerName } } as ClientMessage));
      };
      const sendReconnect = () => {
        // Track that we're waiting for a reconnect response
        reconnectPending.current = true;
        originalReconnectId.current = playerIdRef.current;
        socket.send(JSON.stringify({ type: 'reconnect', payload: { playerId: playerIdRef.current! } } as ClientMessage));
      };

      if (!playerIdRef.current) {
        // No stored ID - this is a new player, send join immediately
        sendJoin();
      } else {
        // We have a stored ID - try to reconnect first
        sendReconnect();
        // Set a timeout to fall back to join if reconnect doesn't work
        // (e.g., if the session expired server-side)
        if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = window.setTimeout(() => {
          // Only send fallback if we haven't received confirmation yet
          if (!hasJoined.current && !fallbackJoinSent.current) {
            // Don't clear playerIdRef yet - wait for server response to either
            // reconnect or join before updating stored ID
            sendJoin();
          }
        }, 2000);
      }
      pingInterval.current = setInterval(() => {
        socket.send(JSON.stringify({ type: 'ping', payload: { timestamp: Date.now() } } as ClientMessage));
      }, 5000);
    },
    onClose: () => {
      setIsConnected(false);
      if (pingInterval.current) clearInterval(pingInterval.current);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      // Reset join/reconnect tracking for next connection attempt
      hasJoined.current = false;
      reconnectPending.current = false;
      fallbackJoinSent.current = false;
      // Keep originalReconnectId - we might need it for the next reconnect attempt
    },
    onMessage: (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      // Defer message handling to avoid setState during render (React StrictMode issue)
      setTimeout(() => handleServerMessage(message), 0);
    },
  });

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }, [socket]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'room_state': {
        if (joinTimeoutRef.current) {
          clearTimeout(joinTimeoutRef.current);
          joinTimeoutRef.current = null;
        }

        // Find our player in the response
        const me = message.payload.players.find(p => p.isYou);

        // Handle race condition: if we already joined with a new ID, ignore late reconnect responses
        if (hasJoined.current && me && me.id !== playerIdRef.current) {
          // This is a late response for a different session - ignore it
          // This can happen if reconnect succeeded after fallback join already completed
          console.log('Ignoring late room_state for different player ID');
          return;
        }

        // Now we're confirmed in the room
        hasJoined.current = true;
        reconnectPending.current = false;
        fallbackJoinSent.current = false;
        setHasReceivedRoomState(true);

        // Convert server's penaltyRemainingMs to client-local penaltyUntil (clock-skew safe)
        const clientPenaltyUntil = message.payload.penaltyRemainingMs
          ? Date.now() + message.payload.penaltyRemainingMs
          : undefined;
        const stateWithClientPenalty = {
          ...message.payload,
          penaltyUntil: clientPenaltyUntil,
        };
        // Apply pending countdown if it arrived before room_state
        if (pendingCountdown.current !== null) {
          setRoomState({
            ...stateWithClientPenalty,
            phase: RoomPhase.COUNTDOWN,
            countdown: pendingCountdown.current,
          });
          pendingCountdown.current = null;
        } else {
          setRoomState(stateWithClientPenalty);
        }
        // Update host status and persist player ID for future reconnects
        if (me) {
          // Persist ID to localStorage for future reconnects
          // Only update if this is a new ID (from join) or confirming reconnect
          if (me.id && me.id !== playerIdRef.current) {
            // New ID from join - clear old ID and persist new one
            persistPlayerId(me.id);
          }
          setIsHost(me.isHost);
        }
        break;
      }

      case 'you_are_host':
        setIsHost(true);
        break;

      case 'player_joined':
        setRoomState(prev => {
          if (!prev) return null;
          const newPlayers = [...prev.players.filter(p => p.id !== message.payload.player.id), message.payload.player];
          return { ...prev, players: newPlayers };
        });
        break;

      case 'player_left': {
        // Check if it's us being removed (kicked) inside the updater where we have current state
        let wasKicked = false;
        setRoomState(prev => {
          if (!prev) return null;
          const kickedPlayer = prev.players.find(p => p.id === message.payload.playerId);
          wasKicked = kickedPlayer?.isYou ?? false;
          return {
            ...prev,
            players: prev.players.filter(p => p.id !== message.payload.playerId)
          };
        });
        // Use setTimeout to ensure setState has completed before checking wasKicked
        setTimeout(() => {
          if (wasKicked) {
            clearStoredPlayerId();
            onKicked?.();
          }
        }, 0);
        break;
      }

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
      case 'host_changed': {
        let currentPlayerIsHost = false;
        setRoomState(prev => {
          if (!prev) return null;
          const players = prev.players.map(p => {
            const updated = { ...p, isHost: p.id === message.payload.playerId };
            if (updated.isYou && updated.isHost) {
              currentPlayerIsHost = true;
            }
            return updated;
          });
          return { ...prev, players };
        });
        setIsHost(currentPlayerIsHost);
        break;
      }

      case 'countdown':
        setRoomState(prev => {
          // If we haven't received room_state yet, store countdown for later
          // The room_state handler will apply it when state arrives
          if (!prev) {
            pendingCountdown.current = message.payload.seconds;
            return null;
          }
          // Negative countdown means cancellation - return to waiting
          if (message.payload.seconds < 0) {
            return {
              ...prev,
              phase: RoomPhase.WAITING,
              countdown: null
            };
          }
          return {
            ...prev,
            phase: RoomPhase.COUNTDOWN,
            countdown: message.payload.seconds
          };
        });
        break;

      case 'round_start':
        setRoomState(prev => {
          // Don't create incomplete state if room_state hasn't arrived yet
          // This should rarely happen since we delayed auto-start
          if (!prev) {
            console.warn('round_start received before room_state');
            return null;
          }
          return {
            ...prev,
            phase: RoomPhase.PLAYING,
            centerCard: message.payload.centerCard,
            yourCard: message.payload.yourCard,
            roundNumber: message.payload.roundNumber,
            roundWinnerId: null,
            roundMatchedSymbolId: null,
            deckRemaining: message.payload.deckRemaining ?? prev.deckRemaining,
          };
        });
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
        // Convert server duration to client-local timestamp (clock-skew safe)
        setRoomState(prev => prev ? {
          ...prev,
          penaltyUntil: Date.now() + message.payload.durationMs
        } : null);
        break;

      case 'game_over':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.GAME_OVER,
          gameEndReason: message.payload.reason,
          bonusAwarded: message.payload.bonusAwarded,
          rejoinWindowEndsAt: message.payload.rejoinWindowMs ? Date.now() + message.payload.rejoinWindowMs : undefined,
          playersWantRematch: [],
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

      case 'play_again_ack':
        setRoomState(prev => prev ? {
          ...prev,
          playersWantRematch: [...(prev.playersWantRematch || []), message.payload.playerId]
        } : null);
        break;

      case 'solo_rejoin_boot':
        clearStoredPlayerId();
        onSoloRejoinBoot?.(message.payload.message);
        break;

      case 'room_reset':
        // Room has been reset - stay connected but wait for room_state
        // The server will send a fresh room_state right after this
        break;

      case 'pong':
        setLatency(Date.now() - message.payload.clientTimestamp);
        break;

      case 'config_updated':
        setRoomState(prev => prev ? {
          ...prev,
          config: message.payload.config,
        } : null);
        break;

      case 'need_more_players':
        // Timer expired but not enough players - timer will restart
        console.log('Need more players:', message.payload.message);
        break;

      case 'room_expired':
        clearStoredPlayerId();
        onRoomExpired?.(message.payload.reason);
        break;

      case 'error':
        // Handle reconnect failure specifically
        if (reconnectPending.current && message.payload.code === 'GAME_IN_PROGRESS') {
          // Reconnect failed - clear the stale ID
          clearStoredPlayerId();
          reconnectPending.current = false;
          // If we haven't sent a fallback join yet, do so now
          if (!fallbackJoinSent.current && !hasJoined.current) {
            fallbackJoinSent.current = true;
            sendMessage({ type: 'join', payload: { playerName } });
          }
          // Don't surface this error to the user - we're handling it internally
          return;
        }
        onError?.(message.payload);
        break;
    }
  }, [onError, onKicked, onRoomExpired, onSoloRejoinBoot, clearStoredPlayerId, persistPlayerId, sendMessage, playerName]);

  const attemptMatch = useCallback((symbolId: number) => {
    sendMessage({
      type: 'match_attempt',
      payload: { symbolId, clientTimestamp: Date.now() }
    });
  }, [sendMessage]);

  const setConfig = useCallback((config: MultiplayerGameConfig) => {
    sendMessage({ type: 'set_config', payload: { config } });
  }, [sendMessage]);

  const startGame = useCallback((config: MultiplayerGameConfig) => {
    sendMessage({ type: 'start_game', payload: { config } });
  }, [sendMessage]);

  const leaveRoom = useCallback(() => {
    clearStoredPlayerId();
    sendMessage({ type: 'leave', payload: {} });
    socket.close();
  }, [clearStoredPlayerId, sendMessage, socket]);

  const kickPlayer = useCallback((playerId: string) => {
    sendMessage({ type: 'kick_player', payload: { playerId } });
  }, [sendMessage]);

  const playAgain = useCallback(() => {
    sendMessage({ type: 'play_again', payload: {} });
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      if (pingInterval.current) clearInterval(pingInterval.current);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    roomState,
    isConnected,
    isHost,
    latency,
    hasReceivedRoomState,
    attemptMatch,
    setConfig,
    startGame,
    leaveRoom,
    kickPlayer,
    playAgain,
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
