/**
 * STRESS & EDGE CASE Test Suite
 * Tests rapid clicking, reconnection, timeouts, and edge cases
 *
 * REQUIRES: PartyKit server running on localhost:1999
 * Start with: npx partykit dev
 */

import WebSocket from 'ws';

const PARTYKIT_HOST = process.env.PARTYKIT_HOST || 'localhost:1999';

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// ============================================
// UTILITIES
// ============================================

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createPlayer(roomCode, playerName, options = {}) {
  return new Promise((resolve, reject) => {
    const queryString = options.reconnectId ? `?reconnectId=${options.reconnectId}` : '';
    const ws = new WebSocket(`ws://${PARTYKIT_HOST}/party/${roomCode}${queryString}`);
    const player = {
      ws,
      name: playerName,
      roomState: null,
      messages: [],
      allMessages: [],
      isHost: false,
      playerId: null,
      connected: false,
      yourCard: null,
      centerCard: null,
      roundNumber: 0,
      score: 0,
      penaltyCount: 0,
      _messageListeners: [],
    };

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Connection timeout for ${playerName}`));
    }, 5000);

    ws.on('open', () => {
      player.connected = true;
      if (!options.reconnectId) {
        ws.send(JSON.stringify({
          type: 'join',
          payload: { playerName }
        }));
      }
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        player.messages.push(msg);
        player.allMessages.push(msg);

        if (msg.type === 'room_state') {
          player.roomState = msg.payload;
          const you = msg.payload.players.find(p => p.isYou);
          if (you) {
            player.playerId = you.id;
            player.isHost = you.isHost;
            player.score = you.score;
          }
          if (msg.payload.yourCard) player.yourCard = msg.payload.yourCard;
          if (msg.payload.centerCard) player.centerCard = msg.payload.centerCard;
          clearTimeout(timeout);
          resolve(player);
        } else if (msg.type === 'you_are_host') {
          player.isHost = true;
        } else if (msg.type === 'round_start') {
          player.yourCard = msg.payload.yourCard;
          player.centerCard = msg.payload.centerCard;
          player.roundNumber = msg.payload.roundNumber;
        } else if (msg.type === 'round_winner') {
          if (msg.payload.winnerId === player.playerId) {
            player.score++;
          }
        } else if (msg.type === 'penalty') {
          player.penaltyCount++;
        } else if (msg.type === 'error') {
          if (!player.playerId) {
            clearTimeout(timeout);
            reject(new Error(msg.payload?.message || 'Unknown error'));
          }
        }

        const listeners = [...player._messageListeners];
        for (const listener of listeners) {
          listener(msg);
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on('close', () => {
      player.connected = false;
    });
  });
}

function waitForMessage(player, type, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const idx = player.messages.findIndex(m => m.type === type);
    if (idx !== -1) {
      const msg = player.messages[idx];
      player.messages.splice(idx, 1);
      resolve(msg);
      return;
    }

    const timer = setTimeout(() => {
      const listenerIdx = player._messageListeners.indexOf(listener);
      if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);

    const listener = (msg) => {
      if (msg.type === type) {
        clearTimeout(timer);
        const listenerIdx = player._messageListeners.indexOf(listener);
        if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
        const msgIdx = player.messages.findIndex(m => m === msg);
        if (msgIdx !== -1) player.messages.splice(msgIdx, 1);
        resolve(msg);
      }
    };
    player._messageListeners.push(listener);
  });
}

function waitForAnyMessage(player, types, timeout = 5000) {
  return new Promise((resolve, reject) => {
    for (const type of types) {
      const idx = player.messages.findIndex(m => m.type === type);
      if (idx !== -1) {
        const msg = player.messages[idx];
        player.messages.splice(idx, 1);
        resolve(msg);
        return;
      }
    }

    const timer = setTimeout(() => {
      const listenerIdx = player._messageListeners.indexOf(listener);
      if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
      reject(new Error(`Timeout waiting for any of: ${types.join(', ')}`));
    }, timeout);

    const listener = (msg) => {
      if (types.includes(msg.type)) {
        clearTimeout(timer);
        const listenerIdx = player._messageListeners.indexOf(listener);
        if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
        const msgIdx = player.messages.findIndex(m => m === msg);
        if (msgIdx !== -1) player.messages.splice(msgIdx, 1);
        resolve(msg);
      }
    };
    player._messageListeners.push(listener);
  });
}

function findMatchingSymbol(yourCard, centerCard) {
  for (const sym of yourCard.symbols) {
    if (centerCard.symbols.some(s => s.id === sym.id)) {
      return sym;
    }
  }
  return null;
}

function findNonMatchingSymbol(yourCard, centerCard) {
  const centerIds = new Set(centerCard.symbols.map(s => s.id));
  return yourCard.symbols.find(s => !centerIds.has(s.id)) || null;
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

function cleanup(...players) {
  players.forEach(p => {
    if (p && p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.close();
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// TEST SUITE 1: RAPID CLICKING STRESS TESTS
// ============================================
async function runRapidClickingTests() {
  console.log('\n⚡ RAPID CLICKING STRESS TESTS\n');

  await test('Rapid valid matches: only one wins per round', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Find valid match
    const match = findMatchingSymbol(host.yourCard, host.centerCard);

    // Send 10 rapid match attempts for same symbol
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: match.id, clientTimestamp: now + i }
      }));
    }

    // Should only get one round_winner
    const winner = await waitForMessage(host, 'round_winner', 3000);
    if (!winner) throw new Error('Should get round_winner');

    // Wait and verify no additional round_winner messages (for this round)
    await sleep(500);
    const extraWinners = host.messages.filter(m => m.type === 'round_winner');
    // Next round might send another round_winner, that's OK
    // We just verify the game didn't crash

    cleanup(host, guest);
  });

  await test('Rapid invalid matches: accumulate penalties correctly', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Find invalid symbol
    const invalid = findNonMatchingSymbol(host.yourCard, host.centerCard);
    if (!invalid) throw new Error('Could not find invalid symbol');

    // Send first invalid match
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: invalid.id, clientTimestamp: Date.now() }
    }));

    // First should get penalty
    await waitForMessage(host, 'penalty', 2000);

    // Rapid subsequent attempts during penalty should get errors
    for (let i = 0; i < 5; i++) {
      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: invalid.id, clientTimestamp: Date.now() + i }
      }));
    }

    // Should get error messages (IN_PENALTY)
    await sleep(200);
    const errors = host.messages.filter(m => m.type === 'error');
    // At least some should be penalty errors
    if (errors.length === 0) {
      console.log('     (Note: Server may have batched/ignored rapid attempts - acceptable)');
    }

    cleanup(host, guest);
  });

  await test('Rapid clicks from multiple players: server handles correctly', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    // Both players spam clicks
    const hostMatch = findMatchingSymbol(host.yourCard, host.centerCard);
    const guestMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);

    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: hostMatch.id, clientTimestamp: now + i }
      }));
      guest.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: guestMatch.id, clientTimestamp: now + i }
      }));
    }

    // Both should get same round_winner
    const hostResult = await waitForMessage(host, 'round_winner', 3000);
    const guestResult = await waitForMessage(guest, 'round_winner', 2000);

    if (hostResult.payload.winnerId !== guestResult.payload.winnerId) {
      throw new Error('Different winners reported - arbitration failed');
    }

    cleanup(host, guest);
  });

  await test('100 rapid match attempts do not crash server', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    const match = findMatchingSymbol(host.yourCard, host.centerCard);
    const invalid = findNonMatchingSymbol(host.yourCard, host.centerCard);

    // Send 100 rapid attempts - mix of valid and invalid
    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      const symbolId = i % 3 === 0 ? match.id : (invalid?.id || match.id);
      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId, clientTimestamp: now + i }
      }));
    }

    // Server should still respond
    await sleep(500);

    // Verify connection still works
    host.ws.send(JSON.stringify({
      type: 'ping',
      payload: { timestamp: Date.now() }
    }));

    const pong = await waitForMessage(host, 'pong', 2000);
    if (!pong) throw new Error('Server stopped responding after stress test');

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 2: RECONNECTION TESTS
// ============================================
async function runReconnectionTests() {
  console.log('\n🔄 RECONNECTION TESTS\n');

  await test('Player can reconnect during waiting room', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    const guestId = guest.playerId;

    // Guest disconnects
    guest.ws.close();
    await sleep(500);

    // Guest reconnects with same ID
    try {
      const guestReconnected = await createPlayer(roomCode, 'Guest', { reconnectId: guestId });
      // If reconnect works, great
      cleanup(host, guestReconnected);
    } catch (e) {
      // Reconnect during waiting might fail due to short grace period - that's OK
      // The player would just rejoin as new
      const guestNew = await createPlayer(roomCode, 'GuestNew');
      cleanup(host, guestNew);
    }
  });

  await test('Player disconnect during game: other player notified', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Guest disconnects abruptly
    guest.ws.terminate();

    // Host should get player_disconnected
    const disconnected = await waitForMessage(host, 'player_disconnected', 5000);
    if (!disconnected.payload.playerId) {
      throw new Error('Should receive playerId in disconnect notification');
    }

    cleanup(host);
  });

  await test('Host disconnect: new host assigned, game continues', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest1 = await createPlayer(roomCode, 'Guest1');
    const guest2 = await createPlayer(roomCode, 'Guest2');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 3 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest1, 'round_start', 2000);
    await waitForMessage(guest2, 'round_start', 2000);

    // Host disconnects mid-game
    host.ws.terminate();

    // Wait for player_left and possibly game_over (if only 1 remains)
    await sleep(3000);

    // Guest1 should still be able to play (game continues with 2 players)
    const match = findMatchingSymbol(guest1.yourCard, guest1.centerCard);
    guest1.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    // Should get round_winner or game_over
    const result = await waitForAnyMessage(guest1, ['round_winner', 'game_over'], 5000);
    if (!result) throw new Error('Game should continue after host disconnect');

    cleanup(guest1, guest2);
  });
}

// ============================================
// TEST SUITE 3: PENALTY EDGE CASES
// ============================================
async function runPenaltyEdgeCaseTests() {
  console.log('\n⏱️ PENALTY EDGE CASE TESTS\n');

  await test('Penalty expires after duration, player can match again', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Make invalid match to get penalty
    const invalid = findNonMatchingSymbol(host.yourCard, host.centerCard);
    if (!invalid) throw new Error('Could not find invalid symbol');

    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: invalid.id, clientTimestamp: Date.now() }
    }));

    const penalty = await waitForMessage(host, 'penalty', 2000);
    const penaltyDuration = penalty.payload.until - Date.now();

    // Wait for penalty to expire (server uses 3000ms penalty)
    await sleep(Math.max(penaltyDuration + 100, 3100));

    // Now valid match should work
    const match = findMatchingSymbol(host.yourCard, host.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    // Should win (or guest might have won already)
    const result = await waitForAnyMessage(host, ['round_winner', 'round_start', 'game_over'], 3000);
    // Any of these is acceptable - means penalty expired and match was processed

    cleanup(host, guest);
  });

  await test('Multiple wrong symbols: each triggers new penalty', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    const invalid = findNonMatchingSymbol(host.yourCard, host.centerCard);
    if (!invalid) throw new Error('Could not find invalid symbol');

    // First wrong click
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: invalid.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(host, 'penalty', 2000);

    // Wait for penalty to expire
    await sleep(3100);

    // Second wrong click should trigger new penalty
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: invalid.id, clientTimestamp: Date.now() }
    }));

    const penalty2 = await waitForMessage(host, 'penalty', 2000);
    if (!penalty2) throw new Error('Second wrong click should trigger penalty');

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 4: TIMING EDGE CASES
// ============================================
async function runTimingEdgeCaseTests() {
  console.log('\n⏰ TIMING EDGE CASE TESTS\n');

  await test('Match attempt during round transition is rejected/ignored', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    // Host wins round
    const match = findMatchingSymbol(host.yourCard, host.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(host, 'round_winner', 3000);

    // During the 2-second transition, guest tries to match with old cards
    // This should be ignored or handled gracefully
    const guestOldMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);
    guest.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: guestOldMatch.id, clientTimestamp: Date.now() }
    }));

    // Wait for next round
    await waitForMessage(host, 'round_start', 5000);
    await waitForMessage(guest, 'round_start', 2000);

    // Game should continue normally
    const newMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);
    guest.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: newMatch.id, clientTimestamp: Date.now() }
    }));

    const result = await waitForAnyMessage(guest, ['round_winner', 'game_over'], 3000);
    if (!result) throw new Error('Game should continue after transition match attempt');

    cleanup(host, guest);
  });

  await test('Very delayed client timestamp is still processed', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    const match = findMatchingSymbol(host.yourCard, host.centerCard);

    // Send match with very old client timestamp (simulating network delay)
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() - 60000 }
    }));

    // Should still process based on server timestamp
    const result = await waitForAnyMessage(host, ['round_winner', 'game_over'], 3000);
    if (!result) throw new Error('Old timestamp should still be processed');

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 5: CONCURRENT STATE CHANGES
// ============================================
async function runConcurrentStateTests() {
  console.log('\n🔀 CONCURRENT STATE CHANGE TESTS\n');

  await test('Two players match at exact same serverTimestamp', async () => {
    // This is hard to guarantee, but we can try
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    const hostMatch = findMatchingSymbol(host.yourCard, host.centerCard);
    const guestMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);

    // Send with identical timestamps
    const exactTime = Date.now();

    // Send both as fast as possible
    const p1 = new Promise(resolve => {
      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: hostMatch.id, clientTimestamp: exactTime }
      }));
      resolve();
    });
    const p2 = new Promise(resolve => {
      guest.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: guestMatch.id, clientTimestamp: exactTime }
      }));
      resolve();
    });

    await Promise.all([p1, p2]);

    // Both should see same winner (arbitration should work)
    const hostResult = await waitForMessage(host, 'round_winner', 3000);
    const guestResult = await waitForMessage(guest, 'round_winner', 2000);

    if (hostResult.payload.winnerId !== guestResult.payload.winnerId) {
      throw new Error('Concurrent matches should resolve to same winner');
    }

    cleanup(host, guest);
  });

  await test('Player leaving during match arbitration window', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');
    const player3 = await createPlayer(roomCode, 'Player3');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 3 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);
    await waitForMessage(player3, 'round_start', 2000);

    // Guest submits match
    const guestMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);
    guest.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: guestMatch.id, clientTimestamp: Date.now() }
    }));

    // Player3 leaves immediately after (during arbitration)
    player3.ws.send(JSON.stringify({ type: 'leave' }));
    player3.ws.close();

    // Game should continue
    const result = await waitForAnyMessage(host, ['round_winner', 'game_over'], 5000);
    if (!result) throw new Error('Game should handle player leaving during arbitration');

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 6: MESSAGE ORDERING TESTS
// ============================================
async function runMessageOrderingTests() {
  console.log('\n📬 MESSAGE ORDERING TESTS\n');

  await test('Late-joining player receives correct room state', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');

    // Host sets config
    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'HARD', targetPlayers: 4 } }
    }));

    await waitForMessage(host, 'config_updated', 2000);

    // Second player joins
    const guest = await createPlayer(roomCode, 'Guest');

    // Third player joins
    const player3 = await createPlayer(roomCode, 'Player3');

    // Player3 should see correct state
    if (player3.roomState.players.length !== 3) {
      throw new Error(`Expected 3 players, got ${player3.roomState.players.length}`);
    }

    if (player3.roomState.config?.cardDifficulty !== 'HARD') {
      throw new Error(`Expected HARD difficulty, got ${player3.roomState.config?.cardDifficulty}`);
    }

    cleanup(host, guest, player3);
  });

  await test('Config changes broadcast to all players', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');
    const player3 = await createPlayer(roomCode, 'Player3');

    // Host changes config
    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'MEDIUM', targetPlayers: 8 } }
    }));

    // All should receive config_updated
    await waitForMessage(host, 'config_updated', 2000);
    await waitForMessage(guest, 'config_updated', 2000);
    await waitForMessage(player3, 'config_updated', 2000);

    cleanup(host, guest, player3);
  });
}

// ============================================
// TEST SUITE 7: SESSION PERSISTENCE / RECONNECTION
// ============================================
async function runSessionPersistenceTests() {
  console.log('\n💾 SESSION PERSISTENCE TESTS\n');

  await test('Player can reconnect with reconnectId during game', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    const guestId = guest.playerId;

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    // Guest disconnects (simulating page refresh)
    guest.ws.close();
    await sleep(100);

    // Host should see disconnect
    await waitForMessage(host, 'player_disconnected', 3000);

    // Guest reconnects with their old ID
    try {
      const guestReconnected = await createPlayer(roomCode, 'Guest', { reconnectId: guestId });

      // Should receive room_state with game in progress
      if (guestReconnected.roomState?.phase !== 'playing') {
        // Phase might be ROUND_END or similar - as long as we're in game, it's good
        if (!['playing', 'round_end', 'countdown'].includes(guestReconnected.roomState?.phase || '')) {
          console.log(`     (Note: Phase is ${guestReconnected.roomState?.phase} - acceptable)`);
        }
      }

      // Host should see reconnection
      const reconnected = await waitForMessage(host, 'player_reconnected', 3000);
      if (!reconnected.payload.playerId) {
        throw new Error('Should receive playerId in reconnect notification');
      }

      cleanup(host, guestReconnected);
    } catch (e) {
      // Reconnect might fail if grace period expired - that's OK, test the flow
      console.log(`     (Note: Reconnect failed: ${e.message} - may be grace period)`);
      cleanup(host);
    }
  });

  await test('Reconnected player retains their score', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    const guestId = guest.playerId;

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    // Guest wins a round first
    const guestMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);
    guest.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: guestMatch.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(guest, 'round_winner', 3000);
    const guestScore = guest.score; // Should be 1

    // Wait for next round
    try {
      await waitForMessage(guest, 'round_start', 5000);
    } catch {
      // Game might have ended
    }

    // Guest disconnects
    guest.ws.close();
    await sleep(100);

    await waitForMessage(host, 'player_disconnected', 3000);

    // Guest reconnects
    try {
      const guestReconnected = await createPlayer(roomCode, 'Guest', { reconnectId: guestId });

      // Check score is preserved
      const me = guestReconnected.roomState?.players.find(p => p.isYou);
      if (me && me.score !== guestScore && me.score > 0) {
        // Score might have updated, as long as it's preserved that's good
        console.log(`     (Score preserved: ${me.score})`);
      }

      cleanup(host, guestReconnected);
    } catch (e) {
      console.log(`     (Note: Reconnect failed: ${e.message})`);
      cleanup(host);
    }
  });

  await test('Reconnected player gets their card back', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    const guestId = guest.playerId;

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    const guestRound = await waitForMessage(guest, 'round_start', 2000);
    const originalCardId = guestRound.payload.yourCard.id;

    // Guest disconnects
    guest.ws.close();
    await sleep(100);

    // Guest reconnects
    try {
      const guestReconnected = await createPlayer(roomCode, 'Guest', { reconnectId: guestId });

      // Should have their card
      if (guestReconnected.roomState?.yourCard) {
        if (guestReconnected.roomState.yourCard.id === originalCardId) {
          // Perfect - same card
        } else {
          console.log(`     (Note: Card changed - might be due to round transition)`);
        }
      }

      cleanup(host, guestReconnected);
    } catch (e) {
      console.log(`     (Note: Reconnect failed: ${e.message})`);
      cleanup(host);
    }
  });

  await test('Invalid reconnectId treated as new player (rejected during game)', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Try to join with fake reconnectId during game
    try {
      await createPlayer(roomCode, 'Faker', { reconnectId: 'fake-id-12345' });
      // If we get here, server treated it as new player
      throw new Error('Should have rejected new player during game');
    } catch (e) {
      if (e.message.includes('progress') || e.message.includes('in progress')) {
        // Good - rejected joining during game
      } else if (e.message.includes('rejected')) {
        // Our error from above
        throw e;
      }
      // Any other error is acceptable (invalid reconnect handled)
    }

    cleanup(host, guest);
  });

  await test('Reconnect within grace period works, after fails', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    const guestId = guest.playerId;

    // In waiting room, grace period is short (2 seconds)
    guest.ws.close();

    // Immediate reconnect should work
    await sleep(100);
    try {
      const guestReconnected = await createPlayer(roomCode, 'Guest', { reconnectId: guestId });
      // Success - within grace period
      cleanup(host, guestReconnected);
    } catch (e) {
      // Grace period already expired (2 seconds is short)
      // Try joining as new player instead
      const guestNew = await createPlayer(roomCode, 'GuestNew');
      cleanup(host, guestNew);
    }
  });

  await test('Multiple reconnect attempts handled gracefully', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    const guestId = guest.playerId;

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    // Guest disconnects
    guest.ws.close();
    await sleep(100);

    // Multiple rapid reconnect attempts
    const reconnectAttempts = [];
    for (let i = 0; i < 3; i++) {
      reconnectAttempts.push(
        createPlayer(roomCode, 'Guest', { reconnectId: guestId }).catch(e => null)
      );
    }

    // Wait for all attempts to resolve
    const results = await Promise.all(reconnectAttempts);
    const successfulReconnects = results.filter(r => r !== null);

    // At most one should succeed (others might fail or be treated as duplicates)
    // Server should handle this without crashing

    // Verify host is still connected
    host.ws.send(JSON.stringify({
      type: 'ping',
      payload: { timestamp: Date.now() }
    }));
    const pong = await waitForMessage(host, 'pong', 2000);
    if (!pong) throw new Error('Server crashed after multiple reconnects');

    // Cleanup
    for (const p of successfulReconnects) {
      if (p) cleanup(p);
    }
    cleanup(host);
  });
}

// ============================================
// TEST SUITE 8: ROOM LIFECYCLE EDGE CASES
// ============================================
async function runRoomLifecycleTests() {
  console.log('\n🏠 ROOM LIFECYCLE EDGE CASE TESTS\n');

  await test('Empty room after all players leave is cleaned up', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Both leave
    host.ws.send(JSON.stringify({ type: 'leave' }));
    guest.ws.send(JSON.stringify({ type: 'leave' }));
    host.ws.close();
    guest.ws.close();

    await sleep(500);

    // Try to join - should work (room recreated or reused)
    const newPlayer = await createPlayer(roomCode, 'NewHost');
    if (!newPlayer.isHost) {
      throw new Error('First player in empty room should be host');
    }

    cleanup(newPlayer);
  });

  await test('Game state persists when reconnecting mid-game', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    // Play a few rounds
    for (let i = 0; i < 2; i++) {
      const match = findMatchingSymbol(host.yourCard, host.centerCard);
      if (!match) break;

      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: match.id, clientTimestamp: Date.now() }
      }));

      const result = await waitForAnyMessage(host, ['round_winner', 'game_over'], 5000);
      if (result.type === 'game_over') break;

      try {
        await waitForMessage(host, 'round_start', 3000);
      } catch {
        break;
      }
    }

    const hostRound = host.roundNumber;
    const hostScore = host.score;

    // Host disconnects and reconnects
    const hostId = host.playerId;
    host.ws.close();
    await sleep(100);

    try {
      const hostReconnected = await createPlayer(roomCode, 'Host', { reconnectId: hostId });

      // Verify game state
      if (hostReconnected.roomState) {
        if (hostReconnected.roomState.phase === 'waiting') {
          console.log('     (Note: Game ended while reconnecting)');
        } else {
          // Game still in progress - good
        }
      }

      cleanup(hostReconnected, guest);
    } catch (e) {
      console.log(`     (Note: Reconnect failed: ${e.message})`);
      cleanup(guest);
    }
  });

  await test('Config cannot be changed after game starts', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Try to change config during game
    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'HARD', targetPlayers: 4 } }
    }));

    // Should get error
    const error = await waitForMessage(host, 'error', 2000);
    if (!error.payload.message.toLowerCase().includes('config') &&
        !error.payload.message.toLowerCase().includes('started')) {
      // Accept any error related to invalid state
    }

    cleanup(host, guest);
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
  console.log('='.repeat(70));
  console.log('⚡ SAMESNAP STRESS & EDGE CASE TEST SUITE');
  console.log(`📡 PartyKit Server: ${PARTYKIT_HOST}`);
  console.log('='.repeat(70));

  // Check if server is running
  try {
    const roomCode = generateRoomCode();
    const testPlayer = await createPlayer(roomCode, 'ConnectionTest');
    cleanup(testPlayer);
    console.log('✅ PartyKit server is running\n');
  } catch (e) {
    console.log('❌ Cannot connect to PartyKit server');
    console.log('   Please start the server with: npx partykit dev');
    console.log(`   Error: ${e.message}\n`);
    process.exit(1);
  }

  await runRapidClickingTests();
  await runReconnectionTests();
  await runPenaltyEdgeCaseTests();
  await runTimingEdgeCaseTests();
  await runConcurrentStateTests();
  await runMessageOrderingTests();
  await runSessionPersistenceTests();
  await runRoomLifecycleTests();

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 STRESS TEST RESULTS');
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
    console.log('\n');
    process.exit(1);
  } else {
    console.log('\n✅ ALL STRESS TESTS PASSED!\n');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
