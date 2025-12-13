/**
 * Hook State Management Tests
 *
 * These tests verify the useMultiplayerGame hook's state transitions
 * by simulating WebSocket messages and checking the resulting state.
 *
 * This tests the LOGIC of the hook without needing a browser.
 * We simulate what the hook SHOULD do when it receives messages.
 *
 * REQUIRES: PartyKit server running on localhost:1999
 */

import WebSocket from 'ws';

const PARTYKIT_HOST = 'localhost:1999';

const testResults = { passed: 0, failed: 0, tests: [] };

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function test(name, fn) {
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
  }
}

/**
 * Simulates what the React hook does:
 * - Maintains roomState
 * - Updates state based on messages
 * - Tracks host status
 */
class HookSimulator {
  constructor() {
    this.roomState = null;
    this.isHost = false;
    this.isConnected = false;
    this.hasReceivedRoomState = false;
    this.pendingCountdown = null;
    this.messages = [];
  }

  // Simulates handleServerMessage from useMultiplayerGame
  handleMessage(message) {
    this.messages.push(message);

    switch (message.type) {
      case 'room_state':
        this.hasReceivedRoomState = true;
        // Convert server's penaltyRemainingMs to client-local penaltyUntil (clock-skew safe)
        const clientPenaltyUntil = message.payload.penaltyRemainingMs
          ? Date.now() + message.payload.penaltyRemainingMs
          : undefined;
        const stateWithClientPenalty = {
          ...message.payload,
          penaltyUntil: clientPenaltyUntil,
        };
        if (this.pendingCountdown !== null) {
          this.roomState = {
            ...stateWithClientPenalty,
            phase: 'COUNTDOWN',
            countdown: this.pendingCountdown,
          };
          this.pendingCountdown = null;
        } else {
          this.roomState = stateWithClientPenalty;
        }
        const me = message.payload.players?.find(p => p.isYou);
        if (me) this.isHost = me.isHost;
        break;

      case 'you_are_host':
        this.isHost = true;
        break;

      case 'player_joined':
        if (this.roomState) {
          const newPlayers = [
            ...this.roomState.players.filter(p => p.id !== message.payload.player.id),
            message.payload.player
          ];
          this.roomState = { ...this.roomState, players: newPlayers };
        }
        break;

      case 'player_left':
        if (this.roomState) {
          this.roomState = {
            ...this.roomState,
            players: this.roomState.players.filter(p => p.id !== message.payload.playerId)
          };
        }
        break;

      case 'countdown':
        if (!this.roomState) {
          this.pendingCountdown = message.payload.seconds;
        } else {
          this.roomState = {
            ...this.roomState,
            phase: 'COUNTDOWN',
            countdown: message.payload.seconds
          };
        }
        break;

      case 'round_start':
        if (this.roomState) {
          this.roomState = {
            ...this.roomState,
            phase: 'PLAYING',
            centerCard: message.payload.centerCard,
            yourCard: message.payload.yourCard,
            roundNumber: message.payload.roundNumber,
            deckRemaining: message.payload.deckRemaining ?? this.roomState.deckRemaining,
            roundWinnerId: null,
            roundMatchedSymbolId: null,
          };
        }
        break;

      case 'round_winner':
        if (this.roomState) {
          this.roomState = {
            ...this.roomState,
            phase: 'ROUND_END',
            roundWinnerId: message.payload.winnerId,
            roundWinnerName: message.payload.winnerName,
            roundMatchedSymbolId: message.payload.matchedSymbolId,
            players: this.roomState.players.map(p =>
              p.id === message.payload.winnerId ? { ...p, score: p.score + 1 } : p
            )
          };
        }
        break;

      case 'penalty':
        // Convert server duration to client-local timestamp (clock-skew safe)
        if (this.roomState) {
          this.roomState = {
            ...this.roomState,
            penaltyUntil: Date.now() + message.payload.durationMs
          };
        }
        break;

      case 'game_over':
        if (this.roomState) {
          this.roomState = {
            ...this.roomState,
            phase: 'GAME_OVER',
            gameEndReason: message.payload.reason,
            bonusAwarded: message.payload.bonusAwarded,
            players: message.payload.finalScores.map(s => {
              const existing = this.roomState.players.find(p => p.id === s.playerId);
              return existing ? { ...existing, score: s.score } : {
                id: s.playerId,
                name: s.name,
                status: 'connected',
                score: s.score,
                hasCard: false,
                isHost: false,
                isYou: false
              };
            })
          };
        }
        break;

      case 'host_changed':
        if (this.roomState) {
          const players = this.roomState.players.map(p => ({
            ...p,
            isHost: p.id === message.payload.playerId
          }));
          this.roomState = { ...this.roomState, players };
          const me = players.find(p => p.isYou);
          this.isHost = !!me?.isHost;
        }
        break;

      case 'config_updated':
        if (this.roomState) {
          this.roomState = {
            ...this.roomState,
            config: message.payload.config,
            targetPlayers: message.payload.config.targetPlayers,
          };
        }
        break;
    }
  }
}

// ============================================
// TEST SUITE 1: INITIAL STATE
// ============================================
async function testInitialState() {
  console.log('\n🔌 INITIAL STATE TESTS\n');

  await test('Hook starts with null roomState', async () => {
    const hook = new HookSimulator();
    if (hook.roomState !== null) throw new Error('roomState should be null initially');
  });

  await test('Hook starts with isHost = false', async () => {
    const hook = new HookSimulator();
    if (hook.isHost !== false) throw new Error('isHost should be false initially');
  });

  await test('Hook starts with hasReceivedRoomState = false', async () => {
    const hook = new HookSimulator();
    if (hook.hasReceivedRoomState !== false) throw new Error('hasReceivedRoomState should be false');
  });
}

// ============================================
// TEST SUITE 2: ROOM_STATE MESSAGE
// ============================================
async function testRoomStateMessage() {
  console.log('\n📬 ROOM_STATE MESSAGE TESTS\n');

  await test('room_state sets roomState correctly', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        roomCode: 'TEST',
        phase: 'WAITING',
        players: [
          { id: 'p1', name: 'Host', isHost: true, isYou: true, score: 0, status: 'connected' }
        ],
        config: { cardDifficulty: 'EASY', targetPlayers: 2 },
        targetPlayers: 2
      }
    });

    if (!hook.roomState) throw new Error('roomState should be set');
    if (hook.roomState.phase !== 'WAITING') throw new Error('phase should be WAITING');
    if (hook.roomState.players.length !== 1) throw new Error('should have 1 player');
  });

  await test('room_state sets hasReceivedRoomState = true', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'WAITING', players: [], config: {} }
    });

    if (!hook.hasReceivedRoomState) throw new Error('hasReceivedRoomState should be true');
  });

  await test('room_state identifies isHost from players array', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'WAITING',
        players: [{ id: 'p1', name: 'Host', isHost: true, isYou: true, score: 0 }],
        config: {}
      }
    });

    if (!hook.isHost) throw new Error('isHost should be true when player.isHost && player.isYou');
  });

  await test('room_state correctly identifies non-host', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'WAITING',
        players: [
          { id: 'p1', name: 'Host', isHost: true, isYou: false, score: 0 },
          { id: 'p2', name: 'Guest', isHost: false, isYou: true, score: 0 }
        ],
        config: {}
      }
    });

    if (hook.isHost) throw new Error('isHost should be false for non-host');
  });
}

// ============================================
// TEST SUITE 3: COUNTDOWN MESSAGE
// ============================================
async function testCountdownMessage() {
  console.log('\n⏱️ COUNTDOWN MESSAGE TESTS\n');

  await test('countdown after room_state updates phase', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'WAITING', players: [], config: {} }
    });
    hook.handleMessage({
      type: 'countdown',
      payload: { seconds: 5 }
    });

    if (hook.roomState.phase !== 'COUNTDOWN') throw new Error('phase should be COUNTDOWN');
    if (hook.roomState.countdown !== 5) throw new Error('countdown should be 5');
  });

  await test('countdown before room_state is stored as pending', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'countdown',
      payload: { seconds: 4 }
    });

    if (hook.pendingCountdown !== 4) throw new Error('pendingCountdown should be 4');
    if (hook.roomState !== null) throw new Error('roomState should still be null');
  });

  await test('pending countdown applied when room_state arrives', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'countdown',
      payload: { seconds: 3 }
    });
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'WAITING', players: [], config: {} }
    });

    if (hook.roomState.phase !== 'COUNTDOWN') throw new Error('phase should be COUNTDOWN');
    if (hook.roomState.countdown !== 3) throw new Error('countdown should be 3');
    if (hook.pendingCountdown !== null) throw new Error('pendingCountdown should be cleared');
  });
}

// ============================================
// TEST SUITE 4: ROUND_START MESSAGE
// ============================================
async function testRoundStartMessage() {
  console.log('\n🎮 ROUND_START MESSAGE TESTS\n');

  await test('round_start updates phase to PLAYING', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'COUNTDOWN', players: [], config: {} }
    });
    hook.handleMessage({
      type: 'round_start',
      payload: {
        yourCard: { id: 1, symbols: [{ id: 1, emoji: '🎯' }] },
        centerCard: { id: 2, symbols: [{ id: 1, emoji: '🎯' }] },
        roundNumber: 1
      }
    });

    if (hook.roomState.phase !== 'PLAYING') throw new Error('phase should be PLAYING');
  });

  await test('round_start sets yourCard', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'COUNTDOWN', players: [], config: {} }
    });
    hook.handleMessage({
      type: 'round_start',
      payload: {
        yourCard: { id: 42, symbols: [{ id: 1, emoji: '🎯' }] },
        centerCard: { id: 2, symbols: [] },
        roundNumber: 1
      }
    });

    if (!hook.roomState.yourCard) throw new Error('yourCard should be set');
    if (hook.roomState.yourCard.id !== 42) throw new Error('yourCard.id should be 42');
  });

  await test('round_start sets centerCard', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'COUNTDOWN', players: [], config: {} }
    });
    hook.handleMessage({
      type: 'round_start',
      payload: {
        yourCard: { id: 1, symbols: [] },
        centerCard: { id: 99, symbols: [{ id: 5, emoji: '🌟' }] },
        roundNumber: 1
      }
    });

    if (!hook.roomState.centerCard) throw new Error('centerCard should be set');
    if (hook.roomState.centerCard.id !== 99) throw new Error('centerCard.id should be 99');
  });

  await test('round_start sets roundNumber', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'COUNTDOWN', players: [], config: {} }
    });
    hook.handleMessage({
      type: 'round_start',
      payload: { yourCard: {}, centerCard: {}, roundNumber: 7 }
    });

    if (hook.roomState.roundNumber !== 7) throw new Error('roundNumber should be 7');
  });

  await test('round_start clears previous winner state', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'ROUND_END',
        players: [],
        config: {},
        roundWinnerId: 'oldWinner',
        roundMatchedSymbolId: 5
      }
    });
    hook.handleMessage({
      type: 'round_start',
      payload: { yourCard: {}, centerCard: {}, roundNumber: 2 }
    });

    if (hook.roomState.roundWinnerId !== null) throw new Error('roundWinnerId should be null');
    if (hook.roomState.roundMatchedSymbolId !== null) throw new Error('roundMatchedSymbolId should be null');
  });

  await test('round_start before room_state does NOT crash', async () => {
    const hook = new HookSimulator();
    // This should not throw
    hook.handleMessage({
      type: 'round_start',
      payload: { yourCard: {}, centerCard: {}, roundNumber: 1 }
    });
    // roomState should still be null (we log warning but don't crash)
    if (hook.roomState !== null) throw new Error('roomState should be null (round_start before room_state)');
  });
}

// ============================================
// TEST SUITE 5: ROUND_WINNER MESSAGE
// ============================================
async function testRoundWinnerMessage() {
  console.log('\n🏆 ROUND_WINNER MESSAGE TESTS\n');

  await test('round_winner updates phase to ROUND_END', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [{ id: 'p1', name: 'Player', score: 0 }],
        config: {}
      }
    });
    hook.handleMessage({
      type: 'round_winner',
      payload: { winnerId: 'p1', winnerName: 'Player', matchedSymbolId: 5 }
    });

    if (hook.roomState.phase !== 'ROUND_END') throw new Error('phase should be ROUND_END');
  });

  await test('round_winner sets roundWinnerId', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'PLAYING', players: [{ id: 'winner123', score: 0 }], config: {} }
    });
    hook.handleMessage({
      type: 'round_winner',
      payload: { winnerId: 'winner123', winnerName: 'Winner', matchedSymbolId: 1 }
    });

    if (hook.roomState.roundWinnerId !== 'winner123') throw new Error('roundWinnerId should be winner123');
  });

  await test('round_winner increments winner score', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [
          { id: 'p1', name: 'Player1', score: 3 },
          { id: 'p2', name: 'Player2', score: 2 }
        ],
        config: {}
      }
    });
    hook.handleMessage({
      type: 'round_winner',
      payload: { winnerId: 'p1', winnerName: 'Player1', matchedSymbolId: 1 }
    });

    const winner = hook.roomState.players.find(p => p.id === 'p1');
    const loser = hook.roomState.players.find(p => p.id === 'p2');
    if (winner.score !== 4) throw new Error('winner score should be 4');
    if (loser.score !== 2) throw new Error('loser score should stay 2');
  });

  await test('round_winner sets matchedSymbolId for highlight', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'PLAYING', players: [{ id: 'p1', score: 0 }], config: {} }
    });
    hook.handleMessage({
      type: 'round_winner',
      payload: { winnerId: 'p1', winnerName: 'P', matchedSymbolId: 42 }
    });

    if (hook.roomState.roundMatchedSymbolId !== 42) throw new Error('matchedSymbolId should be 42');
  });
}

// ============================================
// TEST SUITE 6: HOST_CHANGED MESSAGE
// ============================================
async function testHostChangedMessage() {
  console.log('\n👑 HOST_CHANGED MESSAGE TESTS\n');

  await test('host_changed updates players and host flag', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'WAITING',
        players: [
          { id: 'host', name: 'Host', isHost: true, isYou: false, score: 0, status: 'connected' },
          { id: 'me', name: 'Me', isHost: false, isYou: true, score: 0, status: 'connected' }
        ],
        config: {}
      }
    });

    if (hook.isHost) throw new Error('Should not be host initially');

    hook.handleMessage({ type: 'host_changed', payload: { playerId: 'me' } });
    if (!hook.isHost) throw new Error('Should become host after host_changed');
    const me = hook.roomState.players.find(p => p.id === 'me');
    const other = hook.roomState.players.find(p => p.id === 'host');
    if (!me.isHost) throw new Error('Players array should show new host');
    if (other.isHost) throw new Error('Previous host should lose host flag');

    hook.handleMessage({ type: 'host_changed', payload: { playerId: 'host' } });
    if (hook.isHost) throw new Error('Should no longer be host when host changes back');
  });
}

// ============================================
// TEST SUITE 7: PENALTY MESSAGE
// ============================================
async function testPenaltyMessage() {
  console.log('\n⚠️ PENALTY MESSAGE TESTS\n');

  await test('penalty sets penaltyUntil from durationMs (clock-skew safe)', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'PLAYING', players: [], config: {} }
    });

    const beforeTime = Date.now();
    hook.handleMessage({
      type: 'penalty',
      payload: { serverTimestamp: 1000000000, durationMs: 3000, reason: 'Wrong symbol' }
    });
    const afterTime = Date.now();

    // penaltyUntil should be ~3000ms from now, regardless of serverTimestamp
    const expectedMin = beforeTime + 3000;
    const expectedMax = afterTime + 3000;
    if (hook.roomState.penaltyUntil < expectedMin || hook.roomState.penaltyUntil > expectedMax) {
      throw new Error(`penaltyUntil should be ~3000ms in the future, got ${hook.roomState.penaltyUntil - Date.now()}ms`);
    }
  });

  await test('penalty duration is independent of server clock (clock skew regression)', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'PLAYING', players: [], config: {} }
    });

    // Simulate server with wildly different clock (5 seconds in the past)
    const serverTime = Date.now() - 5000;
    hook.handleMessage({
      type: 'penalty',
      payload: { serverTimestamp: serverTime, durationMs: 3000, reason: 'Wrong symbol' }
    });

    // The penalty should STILL last ~3 seconds from client's perspective
    const remainingMs = hook.roomState.penaltyUntil - Date.now();
    if (remainingMs < 2900 || remainingMs > 3100) {
      throw new Error(`Penalty should last ~3s regardless of server clock skew, got ${remainingMs}ms`);
    }
  });

  await test('penalty duration works when server clock is ahead (clock skew regression)', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'PLAYING', players: [], config: {} }
    });

    // Simulate server with clock 5 seconds AHEAD
    const serverTime = Date.now() + 5000;
    hook.handleMessage({
      type: 'penalty',
      payload: { serverTimestamp: serverTime, durationMs: 3000, reason: 'Wrong symbol' }
    });

    // The penalty should STILL last ~3 seconds from client's perspective
    const remainingMs = hook.roomState.penaltyUntil - Date.now();
    if (remainingMs < 2900 || remainingMs > 3100) {
      throw new Error(`Penalty should last ~3s regardless of server clock skew, got ${remainingMs}ms`);
    }
  });

  await test('room_state penaltyRemainingMs converts to client-local penaltyUntil', async () => {
    const hook = new HookSimulator();
    const beforeTime = Date.now();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [],
        config: {},
        penaltyRemainingMs: 2500  // 2.5 seconds remaining
      }
    });
    const afterTime = Date.now();

    // penaltyUntil should be ~2500ms from now
    const expectedMin = beforeTime + 2500;
    const expectedMax = afterTime + 2500;
    if (hook.roomState.penaltyUntil < expectedMin || hook.roomState.penaltyUntil > expectedMax) {
      throw new Error(`penaltyUntil from room_state should be ~2500ms in the future`);
    }
  });

  await test('room_state without penalty does not set penaltyUntil', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: { phase: 'PLAYING', players: [], config: {} }
    });

    if (hook.roomState.penaltyUntil !== undefined) {
      throw new Error('penaltyUntil should be undefined when no penalty');
    }
  });
}

// ============================================
// TEST SUITE 8: GAME_OVER MESSAGE
// ============================================
async function testGameOverMessage() {
  console.log('\n🎉 GAME_OVER MESSAGE TESTS\n');

  await test('game_over updates phase to GAME_OVER', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [{ id: 'p1', name: 'P1', score: 5 }],
        config: {}
      }
    });
    hook.handleMessage({
      type: 'game_over',
      payload: { finalScores: [{ playerId: 'p1', name: 'P1', score: 10 }] }
    });

    if (hook.roomState.phase !== 'GAME_OVER') throw new Error('phase should be GAME_OVER');
  });

  await test('game_over updates player scores from finalScores', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [
          { id: 'p1', name: 'P1', score: 5, isYou: true },
          { id: 'p2', name: 'P2', score: 3, isYou: false }
        ],
        config: {}
      }
    });
    hook.handleMessage({
      type: 'game_over',
      payload: {
        finalScores: [
          { playerId: 'p1', name: 'P1', score: 25 },
          { playerId: 'p2', name: 'P2', score: 20 }
        ]
      }
    });

    const p1 = hook.roomState.players.find(p => p.id === 'p1');
    const p2 = hook.roomState.players.find(p => p.id === 'p2');
    if (p1.score !== 25) throw new Error('P1 score should be 25');
    if (p2.score !== 20) throw new Error('P2 score should be 20');
  });

  await test('game_over sets gameEndReason for deck_exhausted', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [{ id: 'p1', name: 'P1', score: 5 }],
        config: {}
      }
    });
    hook.handleMessage({
      type: 'game_over',
      payload: {
        finalScores: [{ playerId: 'p1', name: 'P1', score: 10 }],
        reason: 'deck_exhausted'
      }
    });

    if (hook.roomState.gameEndReason !== 'deck_exhausted') {
      throw new Error(`gameEndReason should be deck_exhausted, got ${hook.roomState.gameEndReason}`);
    }
  });

  await test('game_over sets gameEndReason for last_player_standing', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [{ id: 'p1', name: 'P1', score: 2, isYou: true }],
        config: {}
      }
    });
    hook.handleMessage({
      type: 'game_over',
      payload: {
        finalScores: [{ playerId: 'p1', name: 'P1', score: 52 }],
        reason: 'last_player_standing',
        bonusAwarded: 50
      }
    });

    if (hook.roomState.gameEndReason !== 'last_player_standing') {
      throw new Error(`gameEndReason should be last_player_standing, got ${hook.roomState.gameEndReason}`);
    }
    if (hook.roomState.bonusAwarded !== 50) {
      throw new Error(`bonusAwarded should be 50, got ${hook.roomState.bonusAwarded}`);
    }
  });

  await test('game_over with last_player_standing includes bonus in final score', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [{ id: 'survivor', name: 'Survivor', score: 3, isYou: true }],
        config: {}
      }
    });

    // Survivor started with 3 points, gets 45 bonus cards = 48 total
    hook.handleMessage({
      type: 'game_over',
      payload: {
        finalScores: [{ playerId: 'survivor', name: 'Survivor', score: 48 }],
        reason: 'last_player_standing',
        bonusAwarded: 45
      }
    });

    const survivor = hook.roomState.players.find(p => p.id === 'survivor');
    if (survivor.score !== 48) {
      throw new Error(`Survivor score should be 48 (3 + 45 bonus), got ${survivor.score}`);
    }
    if (hook.roomState.bonusAwarded !== 45) {
      throw new Error(`bonusAwarded should be 45, got ${hook.roomState.bonusAwarded}`);
    }
  });

  await test('game_over without reason keeps gameEndReason undefined', async () => {
    const hook = new HookSimulator();
    hook.handleMessage({
      type: 'room_state',
      payload: {
        phase: 'PLAYING',
        players: [{ id: 'p1', name: 'P1', score: 5 }],
        config: {}
      }
    });
    hook.handleMessage({
      type: 'game_over',
      payload: {
        finalScores: [{ playerId: 'p1', name: 'P1', score: 10 }]
        // No reason field (backwards compatibility)
      }
    });

    if (hook.roomState.gameEndReason !== undefined) {
      throw new Error(`gameEndReason should be undefined, got ${hook.roomState.gameEndReason}`);
    }
  });
}

// ============================================
// TEST SUITE 9: FULL FLOW SIMULATION
// ============================================
async function testFullFlowSimulation() {
  console.log('\n🔄 FULL FLOW SIMULATION TESTS\n');

  await test('Complete game flow: join → countdown → play → winner → next round', async () => {
    const hook = new HookSimulator();

    // 1. Join room
    hook.handleMessage({
      type: 'room_state',
      payload: {
        roomCode: 'TEST',
        phase: 'WAITING',
        players: [{ id: 'me', name: 'Me', isHost: true, isYou: true, score: 0, status: 'connected' }],
        config: { cardDifficulty: 'EASY', targetPlayers: 2 },
        targetPlayers: 2
      }
    });
    if (hook.roomState.phase !== 'WAITING') throw new Error('Step 1: Should be WAITING');

    // 2. Second player joins
    hook.handleMessage({
      type: 'player_joined',
      payload: { player: { id: 'other', name: 'Other', isHost: false, isYou: false, score: 0, status: 'connected' } }
    });
    if (hook.roomState.players.length !== 2) throw new Error('Step 2: Should have 2 players');

    // 3. Countdown starts
    hook.handleMessage({ type: 'countdown', payload: { seconds: 5 } });
    if (hook.roomState.phase !== 'COUNTDOWN') throw new Error('Step 3: Should be COUNTDOWN');

    // 4. Round starts
    hook.handleMessage({
      type: 'round_start',
      payload: {
        yourCard: { id: 1, symbols: [{ id: 10, emoji: '🎯' }] },
        centerCard: { id: 2, symbols: [{ id: 10, emoji: '🎯' }] },
        roundNumber: 1
      }
    });
    if (hook.roomState.phase !== 'PLAYING') throw new Error('Step 4: Should be PLAYING');
    if (!hook.roomState.yourCard) throw new Error('Step 4: yourCard should be set');

    // 5. Winner announced
    hook.handleMessage({
      type: 'round_winner',
      payload: { winnerId: 'me', winnerName: 'Me', matchedSymbolId: 10 }
    });
    if (hook.roomState.phase !== 'ROUND_END') throw new Error('Step 5: Should be ROUND_END');
    if (hook.roomState.roundWinnerId !== 'me') throw new Error('Step 5: winnerId should be me');

    const myScore = hook.roomState.players.find(p => p.id === 'me').score;
    if (myScore !== 1) throw new Error('Step 5: My score should be 1');

    // 6. Next round starts
    hook.handleMessage({
      type: 'round_start',
      payload: {
        yourCard: { id: 3, symbols: [] },
        centerCard: { id: 4, symbols: [] },
        roundNumber: 2
      }
    });
    if (hook.roomState.phase !== 'PLAYING') throw new Error('Step 6: Should be PLAYING');
    if (hook.roomState.roundNumber !== 2) throw new Error('Step 6: roundNumber should be 2');
    if (hook.roomState.roundWinnerId !== null) throw new Error('Step 6: roundWinnerId should be cleared');
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
  console.log('='.repeat(70));
  console.log('🧪 HOOK STATE MANAGEMENT TESTS');
  console.log('='.repeat(70));
  console.log('Testing the logic that useMultiplayerGame hook uses to process messages\n');

  await testInitialState();
  await testRoomStateMessage();
  await testCountdownMessage();
  await testRoundStartMessage();
  await testRoundWinnerMessage();
  await testHostChangedMessage();
  await testPenaltyMessage();
  await testGameOverMessage();
  await testFullFlowSimulation();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 HOOK STATE TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
  console.log('='.repeat(70));

  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`   - ${t.name}`);
      console.log(`     ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ ALL HOOK STATE TESTS PASSED!\n');
    console.log('This confirms the state management LOGIC is correct.');
    console.log('Run test-react-integration.mjs to verify UI rendering.\n');
    process.exit(0);
  }
}

runAllTests();
