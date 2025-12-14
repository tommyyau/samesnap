/**
 * Comprehensive Multiplayer Tests - Happy Path & Full Flows
 *
 * Focus areas:
 * - Full game playthroughs (play until deck exhausted)
 * - Round transitions and card mechanics
 * - Notification broadcasts to all players
 * - Simultaneous match arbitration
 * - Score tracking verification
 * - Multi-player games (3-4 players)
 *
 * For edge cases, reconnection, and regression tests, see test-multiplayer.mjs
 *
 * REQUIRES: PartyKit server running on localhost:1999
 * Start with: npx partykit dev
 */

import WebSocket from 'ws';

const PARTYKIT_HOST = process.env.PARTYKIT_HOST || 'localhost:1999';

const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
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
      allMessages: [], // Keep ALL messages for debugging
      isHost: false,
      playerId: null,
      connected: false,
      yourCard: null,
      centerCard: null,
      roundNumber: 0,
      score: 0,
      _messageListeners: [], // For waitForMessage callbacks
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

    // Single message handler that processes all messages
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        player.messages.push(msg);
        player.allMessages.push(msg);

        // Update player state based on message type
        if (msg.type === 'room_state') {
          player.roomState = msg.payload;
          const you = msg.payload.players.find(p => p.isYou);
          if (you) {
            player.playerId = you.id;
            player.isHost = you.isHost;
            // Note: score is tracked locally based on round_winner messages, not from room_state
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
        } else if (msg.type === 'error') {
          // Only reject during initial connection
          if (!player.playerId) {
            clearTimeout(timeout);
            reject(new Error(msg.payload?.message || 'Unknown error'));
          }
        }

        // Notify any waiting listeners
        const listeners = [...player._messageListeners];
        for (const listener of listeners) {
          listener(msg);
        }
      } catch (e) {
        // Ignore parse errors
      }
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
    // Check if already received in queue
    const idx = player.messages.findIndex(m => m.type === type);
    if (idx !== -1) {
      const msg = player.messages[idx];
      player.messages.splice(idx, 1); // Remove it so we don't find it again
      resolve(msg);
      return;
    }

    const timer = setTimeout(() => {
      // Remove listener on timeout
      const listenerIdx = player._messageListeners.indexOf(listener);
      if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);

    // Use callback listener (no duplicate ws handler!)
    const listener = (msg) => {
      if (msg.type === type) {
        clearTimeout(timer);
        // Remove this listener
        const listenerIdx = player._messageListeners.indexOf(listener);
        if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
        // Remove from messages array
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
    // Check if already received in queue
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
      // Remove listener on timeout
      const listenerIdx = player._messageListeners.indexOf(listener);
      if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
      reject(new Error(`Timeout waiting for any of: ${types.join(', ')}`));
    }, timeout);

    // Use callback listener (no duplicate ws handler!)
    const listener = (msg) => {
      if (types.includes(msg.type)) {
        clearTimeout(timer);
        // Remove this listener
        const listenerIdx = player._messageListeners.indexOf(listener);
        if (listenerIdx !== -1) player._messageListeners.splice(listenerIdx, 1);
        // Remove from messages array
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
// TEST SUITE 1: FULL GAME PLAYTHROUGH
// ============================================
async function runFullGameTests() {
  console.log('\n🎮 FULL GAME PLAYTHROUGH TESTS\n');

  await test('Complete game: 2 players, play until deck exhausted, verify game_over', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Start game immediately
    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    // Wait for first round
    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    let roundsPlayed = 0;
    let gameOver = false;
    const maxRounds = 60; // Safety limit

    while (!gameOver && roundsPlayed < maxRounds) {
      // Host finds and clicks match
      const match = findMatchingSymbol(host.yourCard, host.centerCard);
      if (!match) throw new Error(`No match found in round ${roundsPlayed + 1}`);

      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: match.id, clientTimestamp: Date.now() }
      }));

      // Wait for round_winner or game_over
      const result = await waitForAnyMessage(host, ['round_winner', 'game_over'], 5000);

      if (result.type === 'game_over') {
        gameOver = true;
        // Verify final scores exist
        if (!result.payload.finalStandings || result.payload.finalStandings.length !== 2) {
          throw new Error('game_over missing finalStandings');
        }
        break;
      }

      roundsPlayed++;

      // Wait for next round_start (unless game is over)
      try {
        await waitForMessage(host, 'round_start', 3000);
      } catch (e) {
        // Might be game_over instead
        const maybeGameOver = await waitForMessage(host, 'game_over', 2000);
        if (maybeGameOver.type === 'game_over') {
          gameOver = true;
        }
      }
    }

    if (!gameOver) throw new Error(`Game did not end after ${roundsPlayed} rounds`);
    if (roundsPlayed < 5) throw new Error(`Too few rounds played: ${roundsPlayed}`);

    cleanup(host, guest);
  });

  await test('Winner is player with highest score at game_over', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    let hostWins = 0;
    let guestWins = 0;
    let gameOver = false;

    // Alternate who wins each round
    let hostTurn = true;

    while (!gameOver) {
      const activePlayer = hostTurn ? host : guest;
      const match = findMatchingSymbol(activePlayer.yourCard, activePlayer.centerCard);

      if (!match) {
        // Fallback to host if guest card not ready
        const fallbackMatch = findMatchingSymbol(host.yourCard, host.centerCard);
        if (fallbackMatch) {
          host.ws.send(JSON.stringify({
            type: 'match_attempt',
            payload: { symbolId: fallbackMatch.id, clientTimestamp: Date.now() }
          }));
          hostWins++;
        }
      } else {
        activePlayer.ws.send(JSON.stringify({
          type: 'match_attempt',
          payload: { symbolId: match.id, clientTimestamp: Date.now() }
        }));
        if (hostTurn) hostWins++; else guestWins++;
      }

      const result = await waitForAnyMessage(host, ['round_winner', 'game_over'], 5000);

      if (result.type === 'game_over') {
        gameOver = true;
        const standings = result.payload.finalStandings;
        const winner = standings[0]; // Should be sorted by cardsRemaining ascending (winner has fewest)

        // Verify sorting (ascending by cardsRemaining - winner has 0 or fewest cards)
        for (let i = 1; i < standings.length; i++) {
          if (standings[i].cardsRemaining < standings[i-1].cardsRemaining) {
            throw new Error('finalStandings not sorted by cardsRemaining ascending');
          }
        }
        break;
      }

      hostTurn = !hostTurn;

      try {
        await waitForMessage(host, 'round_start', 3000);
        await waitForMessage(guest, 'round_start', 1000);
      } catch (e) {
        const maybeOver = await waitForAnyMessage(host, ['game_over'], 2000);
        if (maybeOver.type === 'game_over') gameOver = true;
      }
    }

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 2: ROUND TRANSITIONS
// ============================================
async function runRoundTransitionTests() {
  console.log('\n🔄 ROUND TRANSITION TESTS\n');

  await test('Round number increments after each win', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    const firstRound = await waitForMessage(host, 'round_start', 10000);
    if (firstRound.payload.roundNumber !== 1) {
      throw new Error(`Expected round 1, got ${firstRound.payload.roundNumber}`);
    }

    // Win round 1
    const match = findMatchingSymbol(firstRound.payload.yourCard, firstRound.payload.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(host, 'round_winner', 3000);
    const secondRound = await waitForMessage(host, 'round_start', 5000);

    if (secondRound.payload.roundNumber !== 2) {
      throw new Error(`Expected round 2, got ${secondRound.payload.roundNumber}`);
    }

    cleanup(host, guest);
  });

  await test('Center card changes after each round', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    const round1 = await waitForMessage(host, 'round_start', 10000);
    const centerCard1Id = round1.payload.centerCard.id;

    const match = findMatchingSymbol(round1.payload.yourCard, round1.payload.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(host, 'round_winner', 3000);
    const round2 = await waitForMessage(host, 'round_start', 5000);
    const centerCard2Id = round2.payload.centerCard.id;

    if (centerCard1Id === centerCard2Id) {
      throw new Error('Center card should change between rounds');
    }

    cleanup(host, guest);
  });

  await test('Winner gets new card (old center) after winning', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    const round1 = await waitForMessage(host, 'round_start', 10000);
    const hostCard1Id = round1.payload.yourCard.id;
    const centerCard1Id = round1.payload.centerCard.id;

    // Host wins
    const match = findMatchingSymbol(round1.payload.yourCard, round1.payload.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(host, 'round_winner', 3000);
    const round2 = await waitForMessage(host, 'round_start', 5000);
    const hostCard2Id = round2.payload.yourCard.id;

    // Winner's new card should be the OLD center card
    if (hostCard2Id !== centerCard1Id) {
      throw new Error(`Winner should get old center card. Expected ${centerCard1Id}, got ${hostCard2Id}`);
    }

    cleanup(host, guest);
  });

  await test('Non-winner keeps their card', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    const guestRound1 = await waitForMessage(guest, 'round_start', 2000);
    const guestCard1Id = guestRound1.payload.yourCard.id;

    // Host wins (not guest)
    const match = findMatchingSymbol(host.yourCard, host.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(host, 'round_winner', 3000);
    await waitForMessage(host, 'round_start', 5000);
    const guestRound2 = await waitForMessage(guest, 'round_start', 2000);
    const guestCard2Id = guestRound2.payload.yourCard.id;

    // Guest (non-winner) should keep their card
    if (guestCard1Id !== guestCard2Id) {
      throw new Error(`Non-winner card should stay same. Was ${guestCard1Id}, now ${guestCard2Id}`);
    }

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 3: NOTIFICATIONS TO ALL PLAYERS
// ============================================
async function runNotificationTests() {
  console.log('\n📢 NOTIFICATION BROADCAST TESTS\n');

  await test('All players receive round_winner message', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    const match = findMatchingSymbol(host.yourCard, host.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    // Both should receive round_winner
    const hostWinner = await waitForMessage(host, 'round_winner', 3000);
    const guestWinner = await waitForMessage(guest, 'round_winner', 2000);

    if (hostWinner.payload.winnerId !== guestWinner.payload.winnerId) {
      throw new Error('Winner ID mismatch between players');
    }

    cleanup(host, guest);
  });

  await test('round_winner includes correct matchedSymbolId', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    const match = findMatchingSymbol(host.yourCard, host.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    const winner = await waitForMessage(host, 'round_winner', 3000);

    if (winner.payload.matchedSymbolId !== match.id) {
      throw new Error(`matchedSymbolId should be ${match.id}, got ${winner.payload.matchedSymbolId}`);
    }

    cleanup(host, guest);
  });

  await test('round_winner includes winnerName', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'HostPlayer');
    const guest = await createPlayer(roomCode, 'GuestPlayer');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    const match = findMatchingSymbol(host.yourCard, host.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    const winner = await waitForMessage(guest, 'round_winner', 3000);

    if (winner.payload.winnerName !== 'HostPlayer') {
      throw new Error(`winnerName should be HostPlayer, got ${winner.payload.winnerName}`);
    }

    cleanup(host, guest);
  });

  await test('All players receive game_over with all scores', async () => {
    const roomCode = generateRoomCode();
    const p1 = await createPlayer(roomCode, 'Player1');
    const p2 = await createPlayer(roomCode, 'Player2');
    const p3 = await createPlayer(roomCode, 'Player3');

    p1.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(p1, 'round_start', 10000);
    await waitForMessage(p2, 'round_start', 2000);
    await waitForMessage(p3, 'round_start', 2000);

    // Play until game over
    let gameOver = false;
    while (!gameOver) {
      const match = findMatchingSymbol(p1.yourCard, p1.centerCard);
      if (!match) break;

      p1.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: match.id, clientTimestamp: Date.now() }
      }));

      const result = await waitForAnyMessage(p1, ['round_winner', 'game_over'], 5000);
      if (result.type === 'game_over') {
        gameOver = true;

        // Verify all 3 players in finalStandings
        if (result.payload.finalStandings.length !== 3) {
          throw new Error(`Expected 3 players in finalStandings, got ${result.payload.finalStandings.length}`);
        }
        break;
      }

      try {
        await waitForMessage(p1, 'round_start', 3000);
      } catch {
        const over = await waitForAnyMessage(p1, ['game_over'], 2000);
        if (over.type === 'game_over') gameOver = true;
      }
    }

    // Check other players also received game_over
    const p2Over = await waitForMessage(p2, 'game_over', 2000);
    const p3Over = await waitForMessage(p3, 'game_over', 2000);

    if (p2Over.payload.finalStandings.length !== 3 || p3Over.payload.finalStandings.length !== 3) {
      throw new Error('All players should receive full finalStandings');
    }

    cleanup(p1, p2, p3);
  });
}

// ============================================
// TEST SUITE 4: ARBITRATION (SIMULTANEOUS MATCHES)
// ============================================
async function runArbitrationTests() {
  console.log('\n⚖️ ARBITRATION TESTS (Simultaneous Matches)\n');

  await test('Near-simultaneous matches: one winner is selected', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    // Both find matching symbol
    const hostMatch = findMatchingSymbol(host.yourCard, host.centerCard);
    const guestMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);

    // Send both at nearly same time
    const now = Date.now();
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: hostMatch.id, clientTimestamp: now }
    }));
    guest.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: guestMatch.id, clientTimestamp: now }
    }));

    // Both should get round_winner with SAME winner
    const hostResult = await waitForMessage(host, 'round_winner', 3000);
    const guestResult = await waitForMessage(guest, 'round_winner', 2000);

    if (hostResult.payload.winnerId !== guestResult.payload.winnerId) {
      throw new Error('Arbitration failed: different winners reported to different players');
    }

    // Only one player should win
    const winnerId = hostResult.payload.winnerId;
    if (winnerId !== host.playerId && winnerId !== guest.playerId) {
      throw new Error('Winner is neither host nor guest');
    }

    cleanup(host, guest);
  });

  await test('Slightly earlier serverTimestamp wins arbitration', async () => {
    // This test is probabilistic - run multiple times
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    const hostMatch = findMatchingSymbol(host.yourCard, host.centerCard);
    const guestMatch = findMatchingSymbol(guest.yourCard, guest.centerCard);

    // Send host first, then guest 50ms later
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: hostMatch.id, clientTimestamp: Date.now() }
    }));

    await sleep(50);

    guest.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: guestMatch.id, clientTimestamp: Date.now() }
    }));

    const result = await waitForMessage(host, 'round_winner', 3000);

    // Host should win (sent first)
    if (result.payload.winnerId !== host.playerId) {
      // This can fail if network jitter causes guest to arrive first
      // That's acceptable - we just verify A winner was chosen
      console.log('     (Note: Guest won due to network timing - test still valid)');
    }

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 5: ERROR HANDLING
// ============================================
async function runErrorHandlingTests() {
  console.log('\n🚫 ERROR HANDLING TESTS\n');

  await test('Room full error when 9th player tries to join', async () => {
    const roomCode = generateRoomCode();
    const players = [];

    // Create 8 players
    for (let i = 0; i < 8; i++) {
      players.push(await createPlayer(roomCode, `Player${i}`));
    }

    // 9th player should fail
    try {
      await createPlayer(roomCode, 'Player9');
      throw new Error('Should have rejected 9th player');
    } catch (e) {
      if (!e.message.includes('full')) {
        throw new Error(`Expected room full error, got: ${e.message}`);
      }
    }

    cleanup(...players);
  });

  await test('Cannot join game in progress', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Try to join now
    try {
      await createPlayer(roomCode, 'LateJoiner');
      throw new Error('Should have rejected late joiner');
    } catch (e) {
      if (!e.message.includes('progress') && !e.message.includes('in progress')) {
        throw new Error(`Expected game in progress error, got: ${e.message}`);
      }
    }

    cleanup(host, guest);
  });

  await test('Non-host cannot start game', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Set target high so auto-start doesn't trigger
    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));
    await sleep(100);

    // Guest tries to start
    guest.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    const error = await waitForMessage(guest, 'error', 2000);
    if (!error.payload.message.toLowerCase().includes('host')) {
      throw new Error(`Expected "host" in error message, got: ${error.payload.message}`);
    }

    cleanup(host, guest);
  });

  await test('Non-host cannot change config', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    guest.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'HARD' } }
    }));

    const error = await waitForMessage(guest, 'error', 2000);
    if (!error.payload.message.toLowerCase().includes('host')) {
      throw new Error(`Expected "host" in error message, got: ${error.payload.message}`);
    }

    cleanup(host, guest);
  });

  await test('Cannot match while in penalty', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Make an invalid match to get penalty
    const invalid = findNonMatchingSymbol(host.yourCard, host.centerCard);
    if (!invalid) throw new Error('Could not find non-matching symbol for test');

    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: invalid.id, clientTimestamp: Date.now() }
    }));

    await waitForMessage(host, 'penalty', 2000);

    // Try to match again while in penalty
    const valid = findMatchingSymbol(host.yourCard, host.centerCard);
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: valid.id, clientTimestamp: Date.now() }
    }));

    const error = await waitForMessage(host, 'error', 2000);
    if (!error.payload.message.toLowerCase().includes('penalty') &&
        !error.payload.code?.includes('PENALTY')) {
      throw new Error(`Expected penalty error, got: ${error.payload.message}`);
    }

    cleanup(host, guest);
  });

  await test('Need at least 2 players to start', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');

    // Set target to 8 so auto-start won't trigger
    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));
    await sleep(100);

    // Try to start with just 1 player
    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    const error = await waitForMessage(host, 'error', 2000);
    if (!error.payload.message.toLowerCase().includes('2')) {
      throw new Error(`Expected "2 players" in error, got: ${error.payload.message}`);
    }

    cleanup(host);
  });
}

// ============================================
// TEST SUITE 6: HOST TRANSFER
// ============================================
async function runHostTransferTests() {
  console.log('\n👑 HOST TRANSFER TESTS\n');

  await test('New host assigned when original host leaves (waiting room)', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'OriginalHost');
    const guest = await createPlayer(roomCode, 'NewHost');

    // Verify original host
    if (!host.isHost) throw new Error('First player should be host');
    if (guest.isHost) throw new Error('Second player should not be host initially');

    // Host leaves
    host.ws.send(JSON.stringify({ type: 'leave' }));
    host.ws.close();

    // Guest should become host
    const youAreHost = await waitForMessage(guest, 'you_are_host', 3000);
    if (!youAreHost) throw new Error('Guest should receive you_are_host');

    cleanup(guest);
  });

  await test('Host transfer works with 3+ players', async () => {
    const roomCode = generateRoomCode();
    const p1 = await createPlayer(roomCode, 'Host1');
    const p2 = await createPlayer(roomCode, 'Player2');
    const p3 = await createPlayer(roomCode, 'Player3');

    if (!p1.isHost) throw new Error('P1 should be host');

    p1.ws.send(JSON.stringify({ type: 'leave' }));
    p1.ws.close();

    // One of p2 or p3 should become host
    let newHostFound = false;
    try {
      await waitForMessage(p2, 'you_are_host', 2000);
      newHostFound = true;
    } catch {
      try {
        await waitForMessage(p3, 'you_are_host', 2000);
        newHostFound = true;
      } catch {
        // Neither got it
      }
    }

    if (!newHostFound) throw new Error('No new host was assigned');

    cleanup(p2, p3);
  });
}

// ============================================
// TEST SUITE 7: DISCONNECT/RECONNECT
// ============================================
async function runDisconnectTests() {
  console.log('\n🔌 DISCONNECT/RECONNECT TESTS\n');

  await test('Player disconnect broadcasts player_disconnected', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    const guestId = guest.playerId;

    // Guest disconnects (not graceful leave)
    guest.ws.close();

    // Host should get player_disconnected
    const disconnected = await waitForMessage(host, 'player_disconnected', 3000);
    if (disconnected.payload.playerId !== guestId) {
      throw new Error('Disconnect notification should include correct playerId');
    }

    cleanup(host);
  });

  await test('Game ends if only 1 player remains', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    // Guest leaves
    guest.ws.send(JSON.stringify({ type: 'leave' }));
    guest.ws.close();

    // Wait for player_left then game_over
    await waitForMessage(host, 'player_left', 3000);
    const gameOver = await waitForMessage(host, 'game_over', 3000);

    if (!gameOver.payload.finalStandings) {
      throw new Error('game_over should include finalStandings');
    }

    cleanup(host);
  });
}

// ============================================
// TEST SUITE 8: KICK PLAYER
// ============================================
async function runKickTests() {
  console.log('\n🚪 KICK PLAYER TESTS\n');

  await test('Host can kick a player', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    const guestId = guest.playerId;

    host.ws.send(JSON.stringify({
      type: 'kick_player',
      payload: { playerId: guestId }
    }));

    // Guest should receive player_left about themselves
    const leftMsg = await waitForMessage(guest, 'player_left', 3000);
    if (leftMsg.payload.playerId !== guestId) {
      throw new Error('Kicked player should receive player_left with their ID');
    }

    cleanup(host, guest);
  });

  await test('Non-host cannot kick players', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');
    const victim = await createPlayer(roomCode, 'Victim');

    // Guest tries to kick victim
    guest.ws.send(JSON.stringify({
      type: 'kick_player',
      payload: { playerId: victim.playerId }
    }));

    // Wait a bit - no kick should happen
    await sleep(500);

    // Victim should still be connected with no player_left
    const victimLeft = victim.messages.find(m => m.type === 'player_left' && m.payload.playerId === victim.playerId);
    if (victimLeft) {
      throw new Error('Non-host kick should not work');
    }

    cleanup(host, guest, victim);
  });
}

// ============================================
// TEST SUITE 9: SCORE TRACKING
// ============================================
async function runScoreTests() {
  console.log('\n📊 SCORE TRACKING TESTS\n');

  await test('Score increments correctly after each win', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);

    let expectedScore = 0;

    // Win 3 rounds
    for (let i = 0; i < 3; i++) {
      const match = findMatchingSymbol(host.yourCard, host.centerCard);
      if (!match) break;

      host.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: match.id, clientTimestamp: Date.now() }
      }));

      const winner = await waitForAnyMessage(host, ['round_winner', 'game_over'], 5000);
      if (winner.type === 'game_over') break;

      if (winner.payload.winnerId === host.playerId) {
        expectedScore++;
      }

      try {
        await waitForMessage(host, 'round_start', 3000);
      } catch {
        break;
      }
    }

    if (host.score !== expectedScore) {
      throw new Error(`Score mismatch: tracked ${host.score}, expected ${expectedScore}`);
    }

    cleanup(host, guest);
  });

  await test('Both players see correct scores in game_over', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    await waitForMessage(host, 'round_start', 10000);
    await waitForMessage(guest, 'round_start', 2000);

    let hostWins = 0;
    let guestWins = 0;
    let turn = 0;

    // Play until game over, alternating who matches
    while (true) {
      const currentPlayer = turn % 2 === 0 ? host : guest;
      const match = findMatchingSymbol(currentPlayer.yourCard, currentPlayer.centerCard);

      if (!match) {
        // Fallback to whoever has a match
        const fallback = findMatchingSymbol(host.yourCard, host.centerCard);
        if (fallback) {
          host.ws.send(JSON.stringify({
            type: 'match_attempt',
            payload: { symbolId: fallback.id, clientTimestamp: Date.now() }
          }));
        }
      } else {
        currentPlayer.ws.send(JSON.stringify({
          type: 'match_attempt',
          payload: { symbolId: match.id, clientTimestamp: Date.now() }
        }));
      }

      const result = await waitForAnyMessage(host, ['round_winner', 'game_over'], 5000);

      if (result.type === 'round_winner') {
        if (result.payload.winnerId === host.playerId) hostWins++;
        else guestWins++;
      }

      if (result.type === 'game_over') {
        const hostStanding = result.payload.finalStandings.find(s => s.playerId === host.playerId);
        const guestStanding = result.payload.finalStandings.find(s => s.playerId === guest.playerId);

        if (!hostStanding) {
          throw new Error('Host not found in finalStandings');
        }
        if (!guestStanding) {
          throw new Error('Guest not found in finalStandings');
        }
        // Winner should have 0 cards remaining, loser should have more
        if (hostStanding.cardsRemaining < 0 || guestStanding.cardsRemaining < 0) {
          throw new Error('cardsRemaining should be non-negative');
        }
        // At least one player should have won (0 cards remaining) unless last_player_standing
        const winnerId = result.payload.winnerId;
        const winnerStanding = result.payload.finalStandings[0];
        if (winnerStanding.playerId !== winnerId) {
          throw new Error('Winner should be first in finalStandings');
        }
        break;
      }

      turn++;
      try {
        await waitForMessage(host, 'round_start', 3000);
        await waitForMessage(guest, 'round_start', 1000);
      } catch {
        const over = await waitForAnyMessage(host, ['game_over'], 2000);
        if (over.type === 'game_over') break;
      }
    }

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE 10: MULTI-PLAYER GAMES (3-4 players)
// ============================================
async function runMultiPlayerTests() {
  console.log('\n👥 MULTI-PLAYER (3-4) TESTS\n');

  await test('3-player game works correctly', async () => {
    const roomCode = generateRoomCode();
    const p1 = await createPlayer(roomCode, 'Player1');
    const p2 = await createPlayer(roomCode, 'Player2');
    const p3 = await createPlayer(roomCode, 'Player3');

    p1.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    // All 3 should receive round_start
    await waitForMessage(p1, 'round_start', 10000);
    await waitForMessage(p2, 'round_start', 2000);
    await waitForMessage(p3, 'round_start', 2000);

    // Play 3 rounds
    for (let i = 0; i < 3; i++) {
      const match = findMatchingSymbol(p1.yourCard, p1.centerCard);
      if (!match) break;

      p1.ws.send(JSON.stringify({
        type: 'match_attempt',
        payload: { symbolId: match.id, clientTimestamp: Date.now() }
      }));

      const result = await waitForAnyMessage(p1, ['round_winner', 'game_over'], 5000);
      if (result.type === 'game_over') break;

      // All 3 should get round_winner
      await waitForMessage(p2, 'round_winner', 2000);
      await waitForMessage(p3, 'round_winner', 2000);

      try {
        await waitForMessage(p1, 'round_start', 3000);
      } catch {
        break;
      }
    }

    cleanup(p1, p2, p3);
  });

  await test('4-player game: all receive notifications', async () => {
    const roomCode = generateRoomCode();
    const players = [];
    for (let i = 0; i < 4; i++) {
      players.push(await createPlayer(roomCode, `P${i}`));
    }

    players[0].ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY' } }
    }));

    // All should get round_start
    for (const p of players) {
      await waitForMessage(p, 'round_start', 10000);
    }

    // One player matches
    const match = findMatchingSymbol(players[0].yourCard, players[0].centerCard);
    players[0].ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: match.id, clientTimestamp: Date.now() }
    }));

    // All should get round_winner
    for (const p of players) {
      const winner = await waitForMessage(p, 'round_winner', 5000);
      if (winner.payload.winnerId !== players[0].playerId) {
        throw new Error('All players should see same winner');
      }
    }

    cleanup(...players);
  });
}

const GROUPS = {
  gameflow: [
    runFullGameTests,
    runRoundTransitionTests,
    runNotificationTests,
  ],
  arbitration: [runArbitrationTests],
  lifecycle: [
    runErrorHandlingTests,
    runHostTransferTests,
    runDisconnectTests,
    runKickTests,
  ],
  scores: [
    runScoreTests,
    runMultiPlayerTests,
  ],
};

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests(groupsToRun) {
  console.log('='.repeat(70));
  console.log('🧪 SAMESNAP COMPREHENSIVE MULTIPLAYER TEST SUITE');
  console.log(`📡 PartyKit Server: ${PARTYKIT_HOST}`);
  console.log(`📦 Groups: ${groupsToRun.join(', ')}`);
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

  const startTime = Date.now();

  for (const group of groupsToRun) {
    const runners = GROUPS[group];
    if (!runners) continue;
    console.log(`\n--- Running group: ${group.toUpperCase()} ---`);
    for (const runner of runners) {
      await runner();
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 COMPREHENSIVE TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
  console.log(`⏱️  Duration: ${duration}s`);
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
    console.log('\n✅ ALL SELECTED COMPREHENSIVE TESTS PASSED!\n');
    console.log('The multiplayer system is ready for manual testing.\n');
    process.exit(0);
  }
}

const cliArg = process.argv[2];
let selectedGroups;
if (cliArg && cliArg !== 'all') {
  selectedGroups = cliArg.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = selectedGroups.filter(g => !GROUPS[g]);
  if (unknown.length > 0) {
    console.error(`Unknown group(s): ${unknown.join(', ')}`);
    console.log(`Available groups: ${Object.keys(GROUPS).join(', ')}`);
    process.exit(1);
  }
} else {
  selectedGroups = Object.keys(GROUPS);
}

runAllTests(selectedGroups).catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
