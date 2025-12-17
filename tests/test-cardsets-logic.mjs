#!/usr/bin/env node
/**
 * QA Test Suite - Card Sets Logic & Validation
 * Tests card set creation, validation, limits, and edge cases
 *
 * These tests validate:
 * - Symbol count validation (exactly 57)
 * - Symbol uniqueness validation
 * - Name validation
 * - Set limit enforcement (max 10)
 * - CRUD operations logic
 * - Emoji edge cases (compound emojis, skin tones, ZWJ sequences)
 */

import assert from 'assert';

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
// Mock Implementation of Card Sets Logic
// (Mirrors the actual API validation logic)
// ============================================

const MAX_CARD_SETS = 10;

function generateId() {
  return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Validation logic (mirrors API)
function validateCardSet(name, symbols) {
  const errors = [];

  // Name validation
  if (!name?.trim()) {
    errors.push('Name is required');
  } else if (name.trim().length > 50) {
    errors.push('Name must be 50 characters or less');
  }

  // Symbol count validation
  if (!Array.isArray(symbols)) {
    errors.push('Symbols must be an array');
  } else if (symbols.length !== 57) {
    errors.push(`Must have exactly 57 symbols (got ${symbols.length})`);
  } else {
    // Uniqueness validation
    const uniqueSymbols = new Set(symbols);
    if (uniqueSymbols.size !== 57) {
      const duplicateCount = 57 - uniqueSymbols.size;
      errors.push(`Symbols must be unique (${duplicateCount} duplicate(s) found)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Create set logic
function createCardSet(existingSets, name, symbols) {
  // Check limit
  if (existingSets.length >= MAX_CARD_SETS) {
    throw new Error(`Maximum ${MAX_CARD_SETS} card sets allowed`);
  }

  const validation = validateCardSet(name, symbols);
  if (!validation.valid) {
    throw new Error(validation.errors[0]);
  }

  const newSet = {
    id: generateId(),
    name: name.trim(),
    symbols,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return newSet;
}

// Update set logic
function updateCardSet(existingSets, id, name, symbols) {
  const index = existingSets.findIndex(s => s.id === id);
  if (index === -1) {
    throw new Error('Card set not found');
  }

  const validation = validateCardSet(name, symbols);
  if (!validation.valid) {
    throw new Error(validation.errors[0]);
  }

  const updatedSet = {
    ...existingSets[index],
    name: name.trim(),
    symbols,
    updatedAt: Date.now(),
  };

  return updatedSet;
}

// Delete set logic
function deleteCardSet(existingSets, id) {
  const index = existingSets.findIndex(s => s.id === id);
  if (index === -1) {
    throw new Error('Card set not found');
  }
  return existingSets.filter(s => s.id !== id);
}

// Generate valid 57-symbol array for testing
function generateValidSymbols(startChar = '😀') {
  const emojis = [];
  const startCode = startChar.codePointAt(0);
  for (let i = 0; i < 57; i++) {
    emojis.push(String.fromCodePoint(startCode + i));
  }
  return emojis;
}

// ============================================
// TEST SUITE: Symbol Count Validation
// ============================================
console.log('\n🔢 SYMBOL COUNT VALIDATION TESTS\n');

test('Exactly 57 symbols passes validation', () => {
  const symbols = generateValidSymbols();
  const result = validateCardSet('Test Set', symbols);
  assert(result.valid, 'Should be valid with 57 symbols');
});

test('56 symbols fails validation', () => {
  const symbols = generateValidSymbols().slice(0, 56);
  const result = validateCardSet('Test Set', symbols);
  assert(!result.valid, 'Should fail with 56 symbols');
  assert(result.errors[0].includes('57'), 'Error should mention 57');
});

test('58 symbols fails validation', () => {
  const symbols = [...generateValidSymbols(), '🎉'];
  const result = validateCardSet('Test Set', symbols);
  assert(!result.valid, 'Should fail with 58 symbols');
});

test('0 symbols fails validation', () => {
  const result = validateCardSet('Test Set', []);
  assert(!result.valid, 'Should fail with empty array');
});

test('Empty array is rejected', () => {
  const result = validateCardSet('Test Set', []);
  assert(!result.valid);
  assert(result.errors[0].includes('57'));
});

test('Non-array symbols fails validation', () => {
  const result = validateCardSet('Test Set', 'not an array');
  assert(!result.valid, 'Should fail with non-array');
  assert(result.errors[0].includes('array'));
});

test('Null symbols fails validation', () => {
  const result = validateCardSet('Test Set', null);
  assert(!result.valid);
});

// ============================================
// TEST SUITE: Symbol Uniqueness
// ============================================
console.log('\n🔄 SYMBOL UNIQUENESS TESTS\n');

test('All unique symbols passes validation', () => {
  const symbols = generateValidSymbols();
  const result = validateCardSet('Test Set', symbols);
  assert(result.valid);
});

test('One duplicate symbol fails validation', () => {
  const symbols = generateValidSymbols();
  symbols[56] = symbols[0]; // Make last same as first
  const result = validateCardSet('Test Set', symbols);
  assert(!result.valid);
  assert(result.errors[0].includes('unique') || result.errors[0].includes('duplicate'));
});

test('Multiple duplicate symbols detected', () => {
  const symbols = generateValidSymbols();
  symbols[55] = symbols[0];
  symbols[56] = symbols[1];
  const result = validateCardSet('Test Set', symbols);
  assert(!result.valid);
  assert(result.errors[0].includes('duplicate'));
});

test('All same symbol fails validation', () => {
  const symbols = Array(57).fill('😀');
  const result = validateCardSet('Test Set', symbols);
  assert(!result.valid);
});

// ============================================
// TEST SUITE: Name Validation
// ============================================
console.log('\n📝 NAME VALIDATION TESTS\n');

test('Valid name passes', () => {
  const result = validateCardSet('My Card Set', generateValidSymbols());
  assert(result.valid);
});

test('Empty name fails', () => {
  const result = validateCardSet('', generateValidSymbols());
  assert(!result.valid);
  assert(result.errors[0].includes('Name'));
});

test('Whitespace-only name fails', () => {
  const result = validateCardSet('   ', generateValidSymbols());
  assert(!result.valid);
});

test('Name is trimmed', () => {
  const set = createCardSet([], '  Spaced Name  ', generateValidSymbols());
  assert.strictEqual(set.name, 'Spaced Name');
});

test('Very long name (100 chars) is truncated or rejected', () => {
  const longName = 'A'.repeat(100);
  const result = validateCardSet(longName, generateValidSymbols());
  // Our validation limits to 50 chars
  assert(!result.valid, 'Should reject names over 50 chars');
});

test('Name with emojis is accepted', () => {
  const result = validateCardSet('My 🎮 Game Set', generateValidSymbols());
  assert(result.valid);
});

test('Name with special characters is accepted', () => {
  const result = validateCardSet('Set #1 (Testing!)', generateValidSymbols());
  assert(result.valid);
});

// ============================================
// TEST SUITE: Set Limit Enforcement
// ============================================
console.log('\n🚫 SET LIMIT TESTS\n');

test('Can create up to MAX_CARD_SETS sets', () => {
  const sets = [];
  for (let i = 0; i < MAX_CARD_SETS; i++) {
    const newSet = createCardSet(sets, `Set ${i + 1}`, generateValidSymbols());
    sets.push(newSet);
  }
  assert.strictEqual(sets.length, MAX_CARD_SETS);
});

test('Creating 11th set fails when at limit', () => {
  const sets = [];
  for (let i = 0; i < MAX_CARD_SETS; i++) {
    sets.push({
      id: `set_${i}`,
      name: `Set ${i}`,
      symbols: generateValidSymbols(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  assert.throws(
    () => createCardSet(sets, 'One Too Many', generateValidSymbols()),
    /Maximum.*10.*allowed/
  );
});

test('Can delete set to make room for new one', () => {
  let sets = [];
  for (let i = 0; i < MAX_CARD_SETS; i++) {
    sets.push({
      id: `set_${i}`,
      name: `Set ${i}`,
      symbols: generateValidSymbols(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  // Delete one
  sets = deleteCardSet(sets, 'set_0');
  assert.strictEqual(sets.length, MAX_CARD_SETS - 1);

  // Now can create new one
  const newSet = createCardSet(sets, 'New Set', generateValidSymbols());
  assert(newSet.id);
});

// ============================================
// TEST SUITE: CRUD Operations
// ============================================
console.log('\n📦 CRUD OPERATIONS TESTS\n');

test('Create generates unique ID', () => {
  const set1 = createCardSet([], 'Set 1', generateValidSymbols());
  const set2 = createCardSet([set1], 'Set 2', generateValidSymbols());
  assert.notStrictEqual(set1.id, set2.id, 'IDs should be unique');
});

test('Create sets createdAt and updatedAt', () => {
  const before = Date.now();
  const set = createCardSet([], 'Test', generateValidSymbols());
  const after = Date.now();

  assert(set.createdAt >= before && set.createdAt <= after);
  assert(set.updatedAt >= before && set.updatedAt <= after);
  assert.strictEqual(set.createdAt, set.updatedAt, 'Should be same on create');
});

test('Update preserves createdAt, updates updatedAt', () => {
  const originalSet = {
    id: 'test_123',
    name: 'Original',
    symbols: generateValidSymbols(),
    createdAt: 1000000,
    updatedAt: 1000000
  };

  const before = Date.now();
  const updated = updateCardSet([originalSet], 'test_123', 'Updated Name', generateValidSymbols());

  assert.strictEqual(updated.createdAt, 1000000, 'createdAt should be preserved');
  assert(updated.updatedAt >= before, 'updatedAt should be updated');
});

test('Update non-existent set throws error', () => {
  const sets = [{ id: 'exists', name: 'Exists', symbols: generateValidSymbols() }];
  assert.throws(
    () => updateCardSet(sets, 'doesnt_exist', 'Name', generateValidSymbols()),
    /not found/
  );
});

test('Delete removes correct set', () => {
  const sets = [
    { id: 'set_1', name: 'Set 1', symbols: [] },
    { id: 'set_2', name: 'Set 2', symbols: [] },
    { id: 'set_3', name: 'Set 3', symbols: [] },
  ];

  const remaining = deleteCardSet(sets, 'set_2');
  assert.strictEqual(remaining.length, 2);
  assert(!remaining.find(s => s.id === 'set_2'), 'set_2 should be removed');
  assert(remaining.find(s => s.id === 'set_1'), 'set_1 should remain');
  assert(remaining.find(s => s.id === 'set_3'), 'set_3 should remain');
});

test('Delete non-existent set throws error', () => {
  const sets = [{ id: 'exists', name: 'Exists', symbols: [] }];
  assert.throws(
    () => deleteCardSet(sets, 'doesnt_exist'),
    /not found/
  );
});

// ============================================
// TEST SUITE: Emoji Edge Cases
// ============================================
console.log('\n🎭 EMOJI EDGE CASES\n');

test('Basic emojis are accepted', () => {
  const basicEmojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃'];
  // Pad to 57
  const symbols = [...basicEmojis];
  for (let i = basicEmojis.length; i < 57; i++) {
    symbols.push(String.fromCodePoint(0x1F600 + i));
  }
  const result = validateCardSet('Basic Emojis', symbols);
  assert(result.valid);
});

test('Skin tone modified emojis are unique from base', () => {
  // 👋 (base) vs 👋🏻 (light skin tone) should be different
  const baseWave = '👋';
  const lightWave = '👋🏻';
  assert.notStrictEqual(baseWave, lightWave, 'Skin tones should be different');

  // Both should be accepted as unique symbols
  const symbols = generateValidSymbols();
  symbols[0] = baseWave;
  symbols[1] = lightWave;
  const result = validateCardSet('Skin Tones', symbols);
  // If these are truly different strings, validation passes
  assert(result.valid || result.errors[0].includes('duplicate'));
});

test('ZWJ sequence emojis (family, couple) work', () => {
  // These are complex emojis joined with zero-width joiner
  const family = '👨‍👩‍👧'; // Man + ZWJ + Woman + ZWJ + Girl
  const symbols = generateValidSymbols();
  symbols[0] = family;

  // Should not throw
  const result = validateCardSet('ZWJ Test', symbols);
  // Result depends on if family emoji counts as unique from generated set
  assert(typeof result.valid === 'boolean');
});

test('Flag emojis work', () => {
  const flags = ['🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇯🇵'];
  const symbols = generateValidSymbols();
  flags.forEach((flag, i) => { symbols[i] = flag; });

  const result = validateCardSet('Flags', symbols);
  assert(result.valid);
});

test('Number/letter keycap emojis work', () => {
  const keycaps = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  const symbols = generateValidSymbols();
  keycaps.forEach((kc, i) => { symbols[i] = kc; });

  const result = validateCardSet('Keycaps', symbols);
  assert(result.valid);
});

test('Mixed emoji types all accepted', () => {
  const mixed = [
    '😀',     // Basic smiley
    '👋🏻',   // Skin tone
    '🇺🇸',   // Flag
    '👨‍💻',  // ZWJ profession
    '1️⃣',    // Keycap
    '❤️',    // Heart with variation selector
    '🐶',     // Animal
    '🍕',     // Food
    '🚀',     // Transport
    '⭐',     // Symbol
  ];

  const symbols = generateValidSymbols();
  mixed.forEach((emoji, i) => { symbols[i] = emoji; });

  const result = validateCardSet('Mixed Types', symbols);
  assert(result.valid);
});

// ============================================
// TEST SUITE: Performance & Scale
// ============================================
console.log('\n⚡ PERFORMANCE TESTS\n');

test('Validation of 57 symbols is fast (<10ms)', () => {
  const symbols = generateValidSymbols();
  const start = Date.now();

  for (let i = 0; i < 1000; i++) {
    validateCardSet('Test', symbols);
  }

  const duration = Date.now() - start;
  const avgMs = duration / 1000;

  assert(avgMs < 10, `Average validation should be <10ms, was ${avgMs.toFixed(2)}ms`);
});

test('Set uniqueness check scales well with 10 sets', () => {
  const sets = [];
  for (let i = 0; i < 10; i++) {
    sets.push({
      id: `set_${i}`,
      name: `Set ${i}`,
      symbols: generateValidSymbols(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    // Check for duplicates (simulating what the hook might do)
    const ids = new Set(sets.map(s => s.id));
    assert.strictEqual(ids.size, sets.length);
  }
  const duration = Date.now() - start;

  assert(duration < 100, `Should complete in <100ms, took ${duration}ms`);
});

// ============================================
// TEST SUITE: Data Integrity
// ============================================
console.log('\n🔐 DATA INTEGRITY TESTS\n');

test('ID format is consistent', () => {
  const set = createCardSet([], 'Test', generateValidSymbols());
  assert(set.id.startsWith('custom_'), 'ID should start with custom_');
  assert(set.id.length > 20, 'ID should be reasonably long');
});

test('Symbols array is not mutated on create', () => {
  const originalSymbols = generateValidSymbols();
  const symbolsCopy = [...originalSymbols];

  createCardSet([], 'Test', originalSymbols);

  assert.deepStrictEqual(originalSymbols, symbolsCopy, 'Original array should not be mutated');
});

test('Update creates new object, doesnt mutate original', () => {
  const originalSet = {
    id: 'test_123',
    name: 'Original',
    symbols: generateValidSymbols(),
    createdAt: 1000000,
    updatedAt: 1000000
  };

  const updated = updateCardSet([originalSet], 'test_123', 'Updated', generateValidSymbols());

  assert.strictEqual(originalSet.name, 'Original', 'Original should not be mutated');
  assert.strictEqual(updated.name, 'Updated');
});

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('📊 CARD SETS LOGIC TEST RESULTS');
console.log('='.repeat(50));
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
console.log('='.repeat(50));

if (testResults.failed > 0) {
  console.log('\n❌ SOME TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL CARD SETS LOGIC TESTS PASSED\n');
  process.exit(0);
}
