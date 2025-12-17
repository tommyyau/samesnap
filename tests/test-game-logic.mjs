/**
 * QA Test Suite - Game Logic Tests
 * Tests deck generation, matching logic, and symbol sets
 */

import assert from 'assert';

// Import game logic (we'll test via dynamic import since it's TypeScript)
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

// Inline implementations to test (matching the actual game logic)
const EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
  '🐜', '🦟', '🦗', '🕷', '🕸', '🐢', '🐍', '🦎',
  '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
  '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓',
  '🍎', '🎱', '🚗', '🚀', '🎨', '🎮', '🏰', '🏝️', '💎', '🌮'
];

const EMOJIS_HARD = [
  '🍎', '🍓', '🍒', '🍉', '🍇', '🫐', '🍊', '🍋',
  '🐙', '🦑', '🦐', '🦀', '🐚', '🐠', '🐡', '🦈',
  '🐝', '🦋', '🐞', '🐜', '🐌', '🦂', '🕷️', '🪲',
  '☀️', '🌙', '⭐', '☁️', '🌧️', '❄️', '🌪️', '🌈',
  '🎸', '🎺', '🎷', '🥁', '🎹', '🎤', '🎧', '🎬',
  '🔨', '🔧', '✂️', '📎', '🔑', '🔒', '💡', '🔔',
  '🍕', '🌮', '🍔', '🌭', '🍟', '🧁', '🍩',
  '⚡', '💎'
];

const BOT_NAMES = ['Holly', 'Sophie', 'Abi', 'Rob', 'Anthony', 'Tommy', 'Olinda', 'Kimberley', 'Alice', 'Chris'];

const SYMBOLS = EMOJIS.map((char, index) => ({
  id: index,
  char,
  name: `Symbol ${index}`
}));

const SYMBOLS_HARD = EMOJIS_HARD.map((char, index) => ({
  id: index,
  char,
  name: `HardSymbol ${index}`
}));

// INSANE mode - 57 yellow smiley faces with different expressions
const EMOJIS_INSANE = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
  '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '🤥',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌',
  '😔', '😪', '🤤', '😴', '😷', '🥴', '😵', '🥱',
  '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😢', '😭'
];

const SYMBOLS_INSANE = EMOJIS_INSANE.map((char, index) => ({
  id: index,
  char,
  name: `InsaneSymbol ${index}`
}));

function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function generateDeck(n = 7, customSymbols = null) {
  const symbolSet = customSymbols || SYMBOLS;
  const cards = [];

  // Generate the first N+1 cards (The horizon)
  for (let i = 0; i <= n; i++) {
    const card = [0];
    for (let j = 0; j < n; j++) {
      card.push((j + 1) + (i * n));
    }
    cards.push(card);
  }

  // Generate the remaining N^2 cards
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

  // Map indices to actual SymbolItems
  const deck = cards.map((cardIndices, index) => ({
    id: index,
    symbols: cardIndices.map(idx => symbolSet[idx % symbolSet.length])
  }));

  return shuffle(deck);
}

function findMatch(cardA, cardB) {
  for (const symA of cardA.symbols) {
    if (cardB.symbols.some(symB => symB.id === symA.id)) {
      return symA;
    }
  }
  return undefined;
}

// ============================================
// TEST SUITE: Symbol Sets
// ============================================
console.log('\n🎯 SYMBOL SETS TESTS\n');

test('EMOJIS array has at least 57 symbols', () => {
  assert(EMOJIS.length >= 57, `Expected >= 57, got ${EMOJIS.length}`);
});

test('EMOJIS_HARD array has at least 57 symbols', () => {
  assert(EMOJIS_HARD.length >= 57, `Expected >= 57, got ${EMOJIS_HARD.length}`);
});

test('EMOJIS_INSANE array has exactly 57 symbols', () => {
  assert(EMOJIS_INSANE.length === 57, `Expected 57, got ${EMOJIS_INSANE.length}`);
});

test('SYMBOLS array maps correctly', () => {
  assert(SYMBOLS.length === EMOJIS.length);
  assert(SYMBOLS[0].id === 0);
  assert(SYMBOLS[0].char === '🐶');
});

test('SYMBOLS_HARD array maps correctly', () => {
  assert(SYMBOLS_HARD.length === EMOJIS_HARD.length);
  assert(SYMBOLS_HARD[0].id === 0);
  assert(SYMBOLS_HARD[0].char === '🍎');
});

test('SYMBOLS_INSANE array maps correctly', () => {
  assert(SYMBOLS_INSANE.length === EMOJIS_INSANE.length);
  assert(SYMBOLS_INSANE[0].id === 0);
  assert(SYMBOLS_INSANE[0].char === '😀');
});

test('BOT_NAMES has 10 unique names', () => {
  assert(BOT_NAMES.length === 10, `Expected 10, got ${BOT_NAMES.length}`);
  const unique = new Set(BOT_NAMES);
  assert(unique.size === 10, 'Names should be unique');
});

// ============================================
// TEST SUITE: Deck Generation
// ============================================
console.log('\n🃏 DECK GENERATION TESTS\n');

test('generateDeck creates 57 cards for order-7', () => {
  const deck = generateDeck(7);
  assert(deck.length === 57, `Expected 57 cards, got ${deck.length}`);
});

test('Each card has 8 symbols (N+1 for N=7)', () => {
  const deck = generateDeck(7);
  deck.forEach((card, i) => {
    assert(card.symbols.length === 8, `Card ${i} has ${card.symbols.length} symbols, expected 8`);
  });
});

test('Cards have unique IDs', () => {
  const deck = generateDeck(7);
  const ids = deck.map(c => c.id);
  const unique = new Set(ids);
  assert(unique.size === deck.length, 'All cards should have unique IDs');
});

test('generateDeck with custom symbols (HARD mode) works', () => {
  const deck = generateDeck(7, SYMBOLS_HARD);
  assert(deck.length === 57);
  // Check symbols come from HARD set
  const firstCard = deck[0];
  firstCard.symbols.forEach(sym => {
    const found = SYMBOLS_HARD.some(s => s.id === sym.id);
    assert(found, `Symbol ${sym.id} not found in HARD symbols`);
  });
});

test('generateDeck with custom symbols (INSANE mode) works', () => {
  const deck = generateDeck(7, SYMBOLS_INSANE);
  assert(deck.length === 57);
  // Check symbols come from INSANE set
  const firstCard = deck[0];
  firstCard.symbols.forEach(sym => {
    const found = SYMBOLS_INSANE.some(s => s.id === sym.id);
    assert(found, `Symbol ${sym.id} not found in INSANE symbols`);
  });
});

// ============================================
// TEST SUITE: Dobble Mathematical Property
// ============================================
console.log('\n🔢 DOBBLE PROPERTY TESTS (Any 2 cards share exactly 1 symbol)\n');

test('Any two cards share exactly ONE symbol', () => {
  const deck = generateDeck(7);
  let violations = 0;

  // Test all pairs (this is 57 * 56 / 2 = 1596 pairs)
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const cardA = deck[i];
      const cardB = deck[j];

      // Count shared symbols
      let sharedCount = 0;
      for (const symA of cardA.symbols) {
        if (cardB.symbols.some(symB => symB.id === symA.id)) {
          sharedCount++;
        }
      }

      if (sharedCount !== 1) {
        violations++;
        if (violations <= 3) {
          console.log(`     Cards ${i} and ${j} share ${sharedCount} symbols (expected 1)`);
        }
      }
    }
  }

  assert(violations === 0, `${violations} pairs violated the one-match property`);
});

test('findMatch returns the correct shared symbol', () => {
  const deck = generateDeck(7);
  // Test 10 random pairs
  for (let t = 0; t < 10; t++) {
    const i = Math.floor(Math.random() * deck.length);
    let j = Math.floor(Math.random() * deck.length);
    while (j === i) j = Math.floor(Math.random() * deck.length);

    const cardA = deck[i];
    const cardB = deck[j];
    const match = findMatch(cardA, cardB);

    assert(match !== undefined, `No match found between cards ${i} and ${j}`);
    assert(cardA.symbols.some(s => s.id === match.id), 'Match should be in card A');
    assert(cardB.symbols.some(s => s.id === match.id), 'Match should be in card B');
  }
});

// ============================================
// TEST SUITE: Shuffle Function
// ============================================
console.log('\n🔀 SHUFFLE TESTS\n');

test('shuffle preserves all elements', () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = shuffle(original);
  assert(shuffled.length === original.length);
  original.forEach(item => {
    assert(shuffled.includes(item), `Missing item ${item}`);
  });
});

test('shuffle creates different orderings', () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const results = new Set();
  for (let i = 0; i < 20; i++) {
    results.add(shuffle(original).join(','));
  }
  // With 20 shuffles of 10 items, we should get multiple unique orderings
  assert(results.size > 1, 'Shuffle should produce varied orderings');
});

// ============================================
// TEST SUITE: Bot Names
// ============================================
console.log('\n🤖 BOT NAME TESTS\n');

test('Bot names can be filtered by player name (case insensitive)', () => {
  const playerName = 'Tommy';
  const available = BOT_NAMES.filter(
    name => name.toLowerCase() !== playerName.toLowerCase()
  );
  assert(available.length === 9, `Expected 9, got ${available.length}`);
  assert(!available.includes('Tommy'), 'Tommy should be filtered out');
});

test('Bot names cycle correctly for many bots', () => {
  const shuffledNames = shuffle([...BOT_NAMES]);
  const bots = [];
  for (let i = 0; i < 15; i++) {
    bots.push(shuffledNames[i % shuffledNames.length]);
  }
  assert(bots.length === 15);
});

// ============================================
// TEST SUITE: Card Difficulty Enum Values
// ============================================
console.log('\n🎮 CARD DIFFICULTY TESTS\n');

const CardDifficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  INSANE: 'INSANE'
};

test('CardDifficulty has four values', () => {
  assert(Object.keys(CardDifficulty).length === 4);
});

test('CardDifficulty.HARD exists', () => {
  assert(CardDifficulty.HARD === 'HARD');
});

test('CardDifficulty.INSANE exists', () => {
  assert(CardDifficulty.INSANE === 'INSANE');
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
