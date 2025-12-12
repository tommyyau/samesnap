/**
 * QA Test Suite - Multiplayer Integration Tests
 * Tests PartyKit server room management, game flow, and WebSocket communication
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

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createPlayer(roomCode, playerName) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${PARTYKIT_HOST}/party/${roomCode}`);
    const player = {
      ws,
      name: playerName,
      roomState: null,
      messages: [],
      isHost: false,
      playerId: null,
      connected: false
    };

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Connection timeout for ${playerName}`));
    }, 5000);

    ws.on('open', () => {
      player.connected = true;
      // Send join message - server expects payload.playerName
      ws.send(JSON.stringify({
        type: 'join',
        payload: { playerName }
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        player.messages.push(msg);

        if (msg.type === 'room_state') {
          player.roomState = msg.payload;  // payload contains the state
          const you = msg.payload.players.find(p => p.isYou);
          if (you) {
            player.playerId = you.id;
            player.isHost = you.isHost;
          }
          clearTimeout(timeout);
          resolve(player);
        } else if (msg.type === 'you_are_host') {
          player.isHost = true;
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(msg.payload?.message || 'Unknown error'));
        }
      } catch (e) {
        // Ignore parse errors for pong messages etc
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
    const existing = player.messages.find(m => m.type === type);
    if (existing) {
      resolve(existing);
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);

    const originalOnMessage = player.ws.onmessage;
    player.ws.on('message', function handler(data) {
      try {
        const msg = JSON.parse(data.toString());
        player.messages.push(msg);
        if (msg.type === type) {
          clearTimeout(timer);
          player.ws.removeListener('message', handler);
          resolve(msg);
        }
      } catch (e) {}
    });
  });
}

function waitForRoomState(player, condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (player.roomState && condition(player.roomState)) {
      resolve(player.roomState);
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for room state condition'));
    }, timeout);

    player.ws.on('message', function handler(data) {
      try {
        const msg = JSON.parse(data.toString());
        player.messages.push(msg);
        if (msg.type === 'room_state') {
          player.roomState = msg.state;
          if (condition(msg.state)) {
            clearTimeout(timer);
            player.ws.removeListener('message', handler);
            resolve(msg.state);
          }
        }
      } catch (e) {}
    });
  });
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

// ============================================
// TEST SUITE: Room Creation & Joining
// ============================================
async function runRoomTests() {
  console.log('\n🏠 ROOM MANAGEMENT TESTS\n');

  await test('Player can create a room and becomes host', async () => {
    const roomCode = generateRoomCode();
    const player = await createPlayer(roomCode, 'TestHost');

    if (!player.isHost) throw new Error('First player should be host');
    if (!player.roomState) throw new Error('Should receive room state');
    if (player.roomState.players.length !== 1) throw new Error('Should have 1 player');

    cleanup(player);
  });

  await test('Second player can join and is not host', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    if (guest.isHost) throw new Error('Second player should not be host');
    if (guest.roomState.players.length !== 2) throw new Error('Should have 2 players');

    cleanup(host, guest);
  });

  await test('Duplicate names get numbered suffix', async () => {
    const roomCode = generateRoomCode();
    const player1 = await createPlayer(roomCode, 'TestPlayer');
    const player2 = await createPlayer(roomCode, 'TestPlayer');

    const players = player2.roomState.players;
    const names = players.map(p => p.name);
    if (!names.includes('TestPlayer')) throw new Error('Original name should exist');
    // Server adds space and number: "TestPlayer 2"
    if (!names.some(n => n.match(/TestPlayer \d/))) throw new Error('Duplicate should be numbered');

    cleanup(player1, player2);
  });

  await test('Room supports up to 8 players', async () => {
    const roomCode = generateRoomCode();
    const players = [];

    for (let i = 0; i < 8; i++) {
      players.push(await createPlayer(roomCode, `Player${i}`));
    }

    const lastPlayer = players[players.length - 1];
    if (lastPlayer.roomState.players.length !== 8) {
      throw new Error(`Expected 8 players, got ${lastPlayer.roomState.players.length}`);
    }

    cleanup(...players);
  });
}

// ============================================
// TEST SUITE: Game Configuration
// ============================================
async function runConfigTests() {
  console.log('\n⚙️ GAME CONFIG TESTS\n');

  await test('Host can set card difficulty to HARD', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');

    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: {
        config: {
          cardDifficulty: 'HARD',
          targetPlayers: 2
        }
      }
    }));

    // Wait for config update
    const configMsg = await waitForMessage(host, 'config_updated', 2000);
    if (configMsg.payload.config.cardDifficulty !== 'HARD') {
      throw new Error(`Expected HARD, got ${configMsg.payload.config.cardDifficulty}`);
    }

    cleanup(host);
  });

  await test('Host can set target player count', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');

    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: {
        config: {
          cardDifficulty: 'EASY',
          targetPlayers: 4
        }
      }
    }));

    const configMsg = await waitForMessage(host, 'config_updated', 2000);
    if (configMsg.payload.config.targetPlayers !== 4) {
      throw new Error(`Expected 4, got ${configMsg.payload.config.targetPlayers}`);
    }

    cleanup(host);
  });

  await test('Config supports all three difficulties (EASY, MEDIUM, HARD)', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');

    for (const difficulty of ['EASY', 'MEDIUM', 'HARD']) {
      host.ws.send(JSON.stringify({
        type: 'set_config',
        payload: { config: { cardDifficulty: difficulty, targetPlayers: 2 } }
      }));
      const msg = await waitForMessage(host, 'config_updated', 2000);
      if (msg.payload.config.cardDifficulty !== difficulty) {
        throw new Error(`Failed to set ${difficulty}`);
      }
      // Clear messages for next iteration
      host.messages = [];
    }

    cleanup(host);
  });
}

// ============================================
// TEST SUITE: Game Flow
// ============================================
async function runGameFlowTests() {
  console.log('\n🎮 GAME FLOW TESTS\n');

  await test('Game auto-starts when target players reached', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');

    // Set target to 2 players
    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    await new Promise(r => setTimeout(r, 100));

    // Second player joins - should trigger auto-start
    const guest = await createPlayer(roomCode, 'Guest');

    // Wait for countdown
    try {
      const countdown = await waitForMessage(host, 'countdown', 3000);
      // Success - game is starting
    } catch (e) {
      // Check if already in playing phase
      if (host.roomState?.phase !== 'countdown' && host.roomState?.phase !== 'playing') {
        throw new Error('Game should auto-start with countdown');
      }
    }

    cleanup(host, guest);
  });

  await test('Host can manually start game', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Set target high so it doesn't auto-start
    host.ws.send(JSON.stringify({
      type: 'set_config',
      payload: { config: { cardDifficulty: 'MEDIUM', targetPlayers: 8 } }
    }));

    await new Promise(r => setTimeout(r, 200));

    // Manually start
    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'MEDIUM', targetPlayers: 8 } }
    }));

    const countdown = await waitForMessage(host, 'countdown', 3000);
    if (typeof countdown.payload.seconds !== 'number') {
      throw new Error('Should receive countdown seconds');
    }

    cleanup(host, guest);
  });

  await test('Players receive cards on round_start', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Start game immediately
    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    // Wait for round_start
    const roundStart = await waitForMessage(host, 'round_start', 10000);

    if (!roundStart.payload.yourCard) throw new Error('Should receive yourCard');
    if (!roundStart.payload.centerCard) throw new Error('Should receive centerCard');
    if (!roundStart.payload.yourCard.symbols || roundStart.payload.yourCard.symbols.length !== 8) {
      throw new Error('Card should have 8 symbols');
    }

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE: Match Mechanics
// ============================================
async function runMatchTests() {
  console.log('\n🎯 MATCH MECHANICS TESTS\n');

  await test('Valid match attempt is accepted', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Start game
    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    // Wait for round start
    const roundStart = await waitForMessage(host, 'round_start', 10000);

    // Find matching symbol
    const yourCard = roundStart.payload.yourCard;
    const centerCard = roundStart.payload.centerCard;

    let matchingSymbol = null;
    for (const sym of yourCard.symbols) {
      if (centerCard.symbols.some(s => s.id === sym.id)) {
        matchingSymbol = sym;
        break;
      }
    }

    if (!matchingSymbol) throw new Error('No matching symbol found (Dobble property violated)');

    // Attempt match
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: matchingSymbol.id, clientTimestamp: Date.now() }
    }));

    // Wait for round_winner
    const winner = await waitForMessage(host, 'round_winner', 3000);
    if (winner.payload.winnerId !== host.playerId) {
      throw new Error('Host should win with correct match');
    }

    cleanup(host, guest);
  });

  await test('Invalid match attempt triggers penalty', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Start game
    host.ws.send(JSON.stringify({
      type: 'start_game',
      payload: { config: { cardDifficulty: 'EASY', targetPlayers: 2 } }
    }));

    const roundStart = await waitForMessage(host, 'round_start', 10000);

    // Find a symbol that's NOT in center card (invalid)
    const yourCard = roundStart.payload.yourCard;
    const centerCard = roundStart.payload.centerCard;
    const centerIds = new Set(centerCard.symbols.map(s => s.id));

    let invalidSymbol = yourCard.symbols.find(s => !centerIds.has(s.id));
    if (!invalidSymbol) {
      // All symbols match - unlikely but use a fake ID
      invalidSymbol = { id: 9999 };
    }

    // Attempt invalid match
    host.ws.send(JSON.stringify({
      type: 'match_attempt',
      payload: { symbolId: invalidSymbol.id, clientTimestamp: Date.now() }
    }));

    // Wait for penalty
    const penalty = await waitForMessage(host, 'penalty', 2000);
    if (!penalty.payload.until) {
      throw new Error('Should receive penalty until timestamp');
    }

    cleanup(host, guest);
  });
}

// ============================================
// TEST SUITE: Player Lifecycle
// ============================================
async function runLifecycleTests() {
  console.log('\n👤 PLAYER LIFECYCLE TESTS\n');

  await test('Player can leave room', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');
    const guest = await createPlayer(roomCode, 'Guest');

    // Guest leaves
    guest.ws.send(JSON.stringify({ type: 'leave' }));
    guest.ws.close();

    // Wait for player_left message on host
    const leftMsg = await waitForMessage(host, 'player_left', 2000);
    if (!leftMsg.payload.playerId) throw new Error('Should receive playerId');

    cleanup(host);
  });

  await test('Ping/pong works for latency', async () => {
    const roomCode = generateRoomCode();
    const host = await createPlayer(roomCode, 'Host');

    const pingTime = Date.now();
    host.ws.send(JSON.stringify({
      type: 'ping',
      payload: { timestamp: pingTime }
    }));

    const pong = await waitForMessage(host, 'pong', 2000);
    // Server echoes back in payload.clientTimestamp
    if (pong.payload?.clientTimestamp !== pingTime) {
      throw new Error('Pong should echo timestamp');
    }

    cleanup(host);
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('🧪 SAMESNAP MULTIPLAYER QA TEST SUITE');
  console.log(`📡 PartyKit Server: ${PARTYKIT_HOST}`);
  console.log('='.repeat(60));

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

  await runRoomTests();
  await runConfigTests();
  await runGameFlowTests();
  await runMatchTests();
  await runLifecycleTests();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
  console.log('='.repeat(60));

  if (testResults.failed > 0) {
    console.log('\n❌ SOME TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('\n✅ ALL MULTIPLAYER TESTS PASSED\n');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
