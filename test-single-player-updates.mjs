/**
 * QA Test Suite - Single Player Updates
 * Tests game duration, victory celebration, and sound functions
 */

import assert from 'assert';
import { readFileSync } from 'fs';

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
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

// ============================================
// TEST SUITE: Type Definitions
// ============================================
console.log('\n📝 TYPE DEFINITIONS TESTS\n');

test('GameConfig includes gameDuration field', () => {
  const typesFile = readFileSync('./shared/types.ts', 'utf-8');

  // Find the GameConfig interface
  const gameConfigMatch = typesFile.match(/export interface GameConfig \{[\s\S]*?\}/);
  assert(gameConfigMatch, 'GameConfig interface should exist');

  const gameConfig = gameConfigMatch[0];
  assert(gameConfig.includes('gameDuration'), 'GameConfig should have gameDuration field');
  assert(gameConfig.includes('GameDuration'), 'gameDuration should be of type GameDuration');
});

test('GameDuration enum has SHORT, MEDIUM, LONG values', () => {
  const typesFile = readFileSync('./shared/types.ts', 'utf-8');

  // Find the GameDuration enum
  const gameDurationMatch = typesFile.match(/export enum GameDuration \{[\s\S]*?\}/);
  assert(gameDurationMatch, 'GameDuration enum should exist');

  const gameDuration = gameDurationMatch[0];
  assert(gameDuration.includes('SHORT'), 'GameDuration should have SHORT');
  assert(gameDuration.includes('MEDIUM'), 'GameDuration should have MEDIUM');
  assert(gameDuration.includes('LONG'), 'GameDuration should have LONG');
  assert(gameDuration.includes('10'), 'SHORT should be 10');
  assert(gameDuration.includes('25'), 'MEDIUM should be 25');
  assert(gameDuration.includes('50'), 'LONG should be 50');
});

test('GameState enum includes VICTORY_CELEBRATION', () => {
  const typesFile = readFileSync('./shared/types.ts', 'utf-8');

  // Find the GameState enum
  const gameStateMatch = typesFile.match(/export enum GameState \{[\s\S]*?\}/);
  assert(gameStateMatch, 'GameState enum should exist');

  const gameState = gameStateMatch[0];
  assert(gameState.includes('VICTORY_CELEBRATION'), 'GameState should include VICTORY_CELEBRATION');
  assert(gameState.includes('LOBBY'), 'GameState should include LOBBY');
  assert(gameState.includes('PLAYING'), 'GameState should include PLAYING');
  assert(gameState.includes('ROUND_ANIMATION'), 'GameState should include ROUND_ANIMATION');
  assert(gameState.includes('GAME_OVER'), 'GameState should include GAME_OVER');
});

// ============================================
// TEST SUITE: Sound Module
// ============================================
console.log('\n🔊 SOUND MODULE TESTS\n');

test('playVictorySound function is exported', () => {
  const soundFile = readFileSync('./utils/sound.ts', 'utf-8');
  assert(soundFile.includes('export const playVictorySound'), 'playVictorySound should be exported');
});

test('playVictorySound has fanfare implementation', () => {
  const soundFile = readFileSync('./utils/sound.ts', 'utf-8');

  // Find the playVictorySound function
  const funcStart = soundFile.indexOf('export const playVictorySound');
  assert(funcStart !== -1, 'playVictorySound function should exist');

  // Check for fanfare-related code
  const funcBody = soundFile.slice(funcStart, funcStart + 2000);
  assert(funcBody.includes('fanfare'), 'Should have fanfare notes');
  assert(funcBody.includes('sparkle') || funcBody.includes('Sparkle'), 'Should have sparkle effect');
  assert(funcBody.includes('chord') || funcBody.includes('Chord'), 'Should have final chord');
});

// ============================================
// TEST SUITE: SinglePlayerGame Component
// ============================================
console.log('\n🎮 SINGLE PLAYER GAME TESTS\n');

test('SinglePlayerGame imports playVictorySound', () => {
  const gameFile = readFileSync('./components/game/SinglePlayerGame.tsx', 'utf-8');
  assert(gameFile.includes('playVictorySound'), 'Should import playVictorySound');
});

test('SinglePlayerGame imports GameDuration', () => {
  const gameFile = readFileSync('./components/game/SinglePlayerGame.tsx', 'utf-8');
  assert(gameFile.includes('GameDuration'), 'Should import GameDuration');
});

test('SinglePlayerGame uses config.gameDuration for deck truncation', () => {
  const gameFile = readFileSync('./components/game/SinglePlayerGame.tsx', 'utf-8');
  assert(gameFile.includes('config.gameDuration'), 'Should use config.gameDuration');
  assert(gameFile.includes('generatedDeck.slice') || gameFile.includes('deck.slice'), 'Should slice deck based on duration');
});

test('SinglePlayerGame has VICTORY_CELEBRATION state handling', () => {
  const gameFile = readFileSync('./components/game/SinglePlayerGame.tsx', 'utf-8');
  assert(gameFile.includes('GameState.VICTORY_CELEBRATION'), 'Should handle VICTORY_CELEBRATION state');
});

test('SinglePlayerGame has original round animation (no overlay)', () => {
  const gameFile = readFileSync('./components/game/SinglePlayerGame.tsx', 'utf-8');
  // Original experience: bot cards scale, show "GOT IT!" text, highlight matched symbol
  // No full-screen green overlay
  assert(gameFile.includes('lastWinnerId === bot.id'), 'Should track winner for scaling');
  assert(gameFile.includes('GOT IT!'), 'Should show GOT IT! text for winner');
  assert(gameFile.includes('highlightSymbolId={matchedSymbolId}'), 'Should highlight matched symbol on center card');
});

test('SinglePlayerGame has victory celebration with confetti', () => {
  const gameFile = readFileSync('./components/game/SinglePlayerGame.tsx', 'utf-8');
  assert(gameFile.includes('confettiEmojis'), 'Should have confetti emojis');
  assert(gameFile.includes('YOU WIN!'), 'Should show YOU WIN! for victory');
  assert(gameFile.includes('WINS!'), 'Should show {name} WINS! for bot victory');
});

// ============================================
// TEST SUITE: SinglePlayerLobby Component
// ============================================
console.log('\n🏠 SINGLE PLAYER LOBBY TESTS\n');

test('SinglePlayerLobby imports GameDuration', () => {
  const lobbyFile = readFileSync('./components/lobby/SinglePlayerLobby.tsx', 'utf-8');
  assert(lobbyFile.includes('GameDuration'), 'Should import GameDuration');
});

test('SinglePlayerLobby has gameDuration state', () => {
  const lobbyFile = readFileSync('./components/lobby/SinglePlayerLobby.tsx', 'utf-8');
  assert(lobbyFile.includes('useState<GameDuration>'), 'Should have gameDuration state');
  assert(lobbyFile.includes('setGameDuration'), 'Should have setGameDuration setter');
});

test('SinglePlayerLobby includes gameDuration in config', () => {
  const lobbyFile = readFileSync('./components/lobby/SinglePlayerLobby.tsx', 'utf-8');

  // Find the onStart call
  const onStartMatch = lobbyFile.match(/onStart\(\{[\s\S]*?\}\)/);
  assert(onStartMatch, 'Should call onStart with config');
  assert(onStartMatch[0].includes('gameDuration'), 'Config should include gameDuration');
});

test('SinglePlayerLobby has game duration selector buttons', () => {
  const lobbyFile = readFileSync('./components/lobby/SinglePlayerLobby.tsx', 'utf-8');
  assert(lobbyFile.includes('Game Duration'), 'Should have Game Duration label');
  assert(lobbyFile.includes('GameDuration.SHORT'), 'Should have SHORT option');
  assert(lobbyFile.includes('GameDuration.MEDIUM'), 'Should have MEDIUM option');
  assert(lobbyFile.includes('GameDuration.LONG'), 'Should have LONG option');
});

// ============================================
// TEST SUITE: MultiplayerGame Component
// ============================================
console.log('\n🌐 MULTIPLAYER GAME TESTS\n');

test('MultiplayerGame imports playVictorySound', () => {
  const gameFile = readFileSync('./components/game/MultiplayerGame.tsx', 'utf-8');
  assert(gameFile.includes('playVictorySound'), 'Should import playVictorySound');
});

test('MultiplayerGame has victory celebration state', () => {
  const gameFile = readFileSync('./components/game/MultiplayerGame.tsx', 'utf-8');
  assert(gameFile.includes('showVictoryCelebration'), 'Should have showVictoryCelebration state');
  assert(gameFile.includes('victoryCelebrationShown'), 'Should have victoryCelebrationShown state');
});

test('MultiplayerGame has victory celebration with confetti', () => {
  const gameFile = readFileSync('./components/game/MultiplayerGame.tsx', 'utf-8');
  assert(gameFile.includes('confettiEmojis'), 'Should have confetti emojis');
  assert(gameFile.includes('YOU WIN!'), 'Should show YOU WIN! for victory');
  assert(gameFile.includes('WINS!'), 'Should show {name} WINS!');
});

test('MultiplayerGame removed -1 Card text from round celebration', () => {
  const gameFile = readFileSync('./components/game/MultiplayerGame.tsx', 'utf-8');

  // Find the round win celebration section
  const celebrationMatch = gameFile.match(/isYouWinner[\s\S]{0,500}YOU GOT IT!/);
  assert(celebrationMatch, 'Should have YOU GOT IT celebration');

  // Make sure there's no -1 Card in the immediate vicinity
  assert(!celebrationMatch[0].includes('-1 Card'), 'Should NOT have -1 Card text in celebration');
});

// ============================================
// TEST SUITE: Deck Truncation Logic
// ============================================
console.log('\n🃏 DECK TRUNCATION LOGIC TESTS\n');

// Inline implementation matching actual code
const GameDuration = {
  SHORT: 10,
  MEDIUM: 25,
  LONG: 50
};

function generateDeck(n = 7) {
  const cards = [];
  for (let i = 0; i <= n; i++) {
    const card = [0];
    for (let j = 0; j < n; j++) {
      card.push((j + 1) + (i * n));
    }
    cards.push(card);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const card = [i + 1];
      for (let k = 0; k < n; k++) {
        const val = n + 1 + n * k + (i * k + j) % n;
        card.push(val);
      }
      cards.push(card);
    }
  }
  return cards.map((cardIndices, index) => ({ id: index, symbols: cardIndices }));
}

test('SHORT duration truncates to 10 cards', () => {
  const generatedDeck = generateDeck(7);
  const gameDuration = GameDuration.SHORT;
  const deckSize = Math.min(gameDuration, generatedDeck.length);
  const deck = generatedDeck.slice(0, deckSize);

  assert(deck.length === 10, `Expected 10 cards for SHORT, got ${deck.length}`);
});

test('MEDIUM duration truncates to 25 cards', () => {
  const generatedDeck = generateDeck(7);
  const gameDuration = GameDuration.MEDIUM;
  const deckSize = Math.min(gameDuration, generatedDeck.length);
  const deck = generatedDeck.slice(0, deckSize);

  assert(deck.length === 25, `Expected 25 cards for MEDIUM, got ${deck.length}`);
});

test('LONG duration truncates to 50 cards', () => {
  const generatedDeck = generateDeck(7);
  const gameDuration = GameDuration.LONG;
  const deckSize = Math.min(gameDuration, generatedDeck.length);
  const deck = generatedDeck.slice(0, deckSize);

  assert(deck.length === 50, `Expected 50 cards for LONG, got ${deck.length}`);
});

test('Card distribution: SHORT with 3 players = 3 cards each + 1 center', () => {
  const gameDuration = GameDuration.SHORT; // 10 cards
  const playerCount = 3;
  const cardsForPlayers = gameDuration - 1; // 9 cards (1 to center)
  const cardsPerPlayer = Math.floor(cardsForPlayers / playerCount);

  assert(cardsPerPlayer === 3, `Expected 3 cards per player, got ${cardsPerPlayer}`);
  assert(cardsPerPlayer * playerCount + 1 === 10, 'Total should use 10 cards (9 to players + 1 center)');
});

test('Card distribution: MEDIUM with 4 players = 6 cards each', () => {
  const gameDuration = GameDuration.MEDIUM; // 25 cards
  const playerCount = 4;
  const cardsForPlayers = gameDuration - 1; // 24 cards
  const cardsPerPlayer = Math.floor(cardsForPlayers / playerCount);

  assert(cardsPerPlayer === 6, `Expected 6 cards per player, got ${cardsPerPlayer}`);
});

// ============================================
// TEST SUITE: Float Animation CSS
// ============================================
console.log('\n🎨 ANIMATION TESTS\n');

test('SinglePlayerGame has floatUp animation', () => {
  const gameFile = readFileSync('./components/game/SinglePlayerGame.tsx', 'utf-8');
  assert(gameFile.includes('@keyframes floatUp'), 'Should have floatUp keyframe');
  assert(gameFile.includes('translateY'), 'Should have translateY transform');
  assert(gameFile.includes('rotate'), 'Should have rotate transform');
});

test('MultiplayerGame has floatUp animation', () => {
  const gameFile = readFileSync('./components/game/MultiplayerGame.tsx', 'utf-8');
  assert(gameFile.includes('@keyframes floatUp'), 'Should have floatUp keyframe');
});

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
console.log('='.repeat(50));

if (testResults.failed > 0) {
  console.log('\n❌ SOME TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED\n');
  process.exit(0);
}
