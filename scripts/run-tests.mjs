#!/usr/bin/env node
/**
 * Test Runner with Logging
 *
 * Wraps test execution and logs results with timing to skills/test-runs.log
 *
 * Usage:
 *   node scripts/run-tests.mjs [suite]
 *
 * Suites:
 *   all          - Run all test suites (default)
 *   multiplayer  - Run multiplayer tests only
 *   comprehensive - Run comprehensive tests only
 *   logic        - Run game logic tests only
 *   hook         - Run hook state tests only
 *   stress       - Run stress tests only
 */

import { spawn } from 'child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, symlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOG_DIR = join(PROJECT_ROOT, 'skills');
const LATEST_LOG_LINK = join(LOG_DIR, 'test-runs-latest.log');

// Generate timestamped log filename
function getLogFilename() {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace(/\.\d{3}Z$/, '');
  return join(LOG_DIR, `test-runs-${timestamp}.log`);
}

const LOG_FILE = getLogFilename();

// Test suite definitions
const SUITES = {
  logic: {
    name: 'Game Logic',
    command: 'node',
    args: ['test-game-logic.mjs'],
    expectedDuration: '~5s'
  },
  multiplayer: {
    name: 'Multiplayer',
    command: 'node',
    args: ['test-multiplayer.mjs'],
    expectedDuration: '~30s'
  },
  hook: {
    name: 'Hook State',
    command: 'node',
    args: ['test-hook-state.mjs'],
    expectedDuration: '~5s'
  },
  stress: {
    name: 'Stress',
    command: 'node',
    args: ['test-multiplayer-stress.mjs'],
    expectedDuration: '~2-3 min'
  },
  gameflow: {
    name: 'Comprehensive - Gameflow',
    command: 'node',
    args: ['test-multiplayer-comprehensive.mjs', 'gameflow'],
    expectedDuration: '~4 min'
  },
  arbitration: {
    name: 'Comprehensive - Arbitration',
    command: 'node',
    args: ['test-multiplayer-comprehensive.mjs', 'arbitration'],
    expectedDuration: '~1 min'
  },
  lifecycle: {
    name: 'Comprehensive - Lifecycle',
    command: 'node',
    args: ['test-multiplayer-comprehensive.mjs', 'lifecycle'],
    expectedDuration: '~3 min'
  },
  scores: {
    name: 'Comprehensive - Scores',
    command: 'node',
    args: ['test-multiplayer-comprehensive.mjs', 'scores'],
    expectedDuration: '~2 min'
  }
};

// Suite groups
const GROUPS = {
  // Stage-based plans. Each nested array runs in parallel; stages run sequentially.
  all: [
    ['logic', 'hook'],
    ['multiplayer', 'stress'],
    ['gameflow', 'arbitration', 'lifecycle', 'scores']
  ],
  quick: [
    ['logic', 'hook'],
    ['multiplayer']
  ]
};

GROUPS.full = GROUPS.all;
GROUPS.comprehensive = [['gameflow', 'arbitration', 'lifecycle', 'scores']];

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

function formatTimestamp(date) {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

function parseTestOutput(output) {
  // Look for common test result patterns
  const passMatch = output.match(/(?:✅\s*Passed|PASSED):\s*(\d+)/i);
  const failMatch = output.match(/(?:❌\s*Failed|FAILED):\s*(\d+)/i);
  const totalMatch = output.match(/(?:📝\s*Total|TOTAL):\s*(\d+)/i);

  // Also check for individual test lines
  const passedTests = (output.match(/✅/g) || []).length;
  const failedTests = (output.match(/❌/g) || []).length;

  return {
    passed: passMatch ? parseInt(passMatch[1]) : passedTests,
    failed: failMatch ? parseInt(failMatch[1]) : failedTests,
    total: totalMatch ? parseInt(totalMatch[1]) : (passedTests + failedTests)
  };
}

function getPreviousTestCounts(suiteName) {
  if (!existsSync(LOG_DIR)) return null;

  // Find the most recent log file (excluding the current one being created)
  const logFiles = readdirSync(LOG_DIR)
    .filter(f => f.startsWith('test-runs-') && f.endsWith('.log') && !f.includes('latest'))
    .sort()
    .reverse();

  for (const logFile of logFiles) {
    const logPath = join(LOG_DIR, logFile);
    if (logPath === LOG_FILE) continue; // Skip current log file

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').reverse();

    for (const line of lines) {
      if (line.includes(`[${suiteName}]`) && line.includes('passed')) {
        const match = line.match(/(\d+)\s*passed/);
        if (match) return parseInt(match[1]);
      }
    }
  }
  return null;
}

async function runSuite(suiteKey) {
  const suite = SUITES[suiteKey];
  if (!suite) {
    console.error(`Unknown suite: ${suiteKey}`);
    return { success: false, error: 'Unknown suite' };
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Running: ${suite.name} (expected: ${suite.expectedDuration})`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = new Date();

  return new Promise((resolve) => {
    let output = '';

    const proc = spawn(suite.command, suite.args, {
      cwd: PROJECT_ROOT,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text);
      output += text;
    });

    proc.on('close', (code) => {
      const endTime = new Date();
      const duration = endTime - startTime;
      const results = parseTestOutput(output);
      const previousCount = getPreviousTestCounts(suite.name);

      resolve({
        suite: suite.name,
        suiteKey,
        success: code === 0 && results.failed === 0,
        exitCode: code,
        startTime,
        endTime,
        duration,
        output,  // Include full output for detailed logging
        ...results,
        previousCount,
        newTests: previousCount !== null ? results.total - previousCount : null
      });
    });

    proc.on('error', (err) => {
      resolve({
        suite: suite.name,
        suiteKey,
        success: false,
        error: err.message,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime
      });
    });
  });
}

function logResults(results, totalDuration) {
  // Ensure skills directory exists
  const skillsDir = dirname(LOG_FILE);
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  const timestamp = formatTimestamp(new Date());
  const thickSeparator = '═'.repeat(70);
  const thinSeparator = '─'.repeat(70);

  let logEntry = `\n${thickSeparator}\n`;
  logEntry += `TEST RUN: ${timestamp}\n`;
  logEntry += `${thickSeparator}\n`;

  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = formatDuration(result.duration);

    logEntry += `\n${thinSeparator}\n`;
    logEntry += `[${result.suite}] ${status} | Duration: ${duration}\n`;
    logEntry += `Started: ${formatTimestamp(result.startTime)} | Ended: ${formatTimestamp(result.endTime)}\n`;
    logEntry += `${thinSeparator}\n\n`;

    // Include full detailed test output
    if (result.output) {
      // Strip ANSI color codes for clean log file
      const cleanOutput = result.output.replace(/\x1b\[[0-9;]*m/g, '');
      logEntry += cleanOutput;
    }

    if (result.passed !== undefined) {
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalTests += result.total;

      if (result.newTests !== null && result.newTests !== 0) {
        const sign = result.newTests > 0 ? '+' : '';
        logEntry += `\n📈 Change: ${sign}${result.newTests} tests since last run\n`;
      }
    }

    if (result.error) {
      logEntry += `\n⚠️  Error: ${result.error}\n`;
    }
  }

  logEntry += `\n${thickSeparator}\n`;
  logEntry += `📊 SUMMARY\n`;
  logEntry += `${thickSeparator}\n`;
  logEntry += `  Total Duration: ${formatDuration(totalDuration)}\n`;
  logEntry += `  Total Tests:    ${totalTests}\n`;
  logEntry += `  Passed:         ${totalPassed}\n`;
  logEntry += `  Failed:         ${totalFailed}\n`;
  logEntry += `  Success Rate:   ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%\n`;
  logEntry += `${thickSeparator}\n`;

  appendFileSync(LOG_FILE, logEntry);

  // Update symlink to point to latest log
  try {
    if (existsSync(LATEST_LOG_LINK)) {
      unlinkSync(LATEST_LOG_LINK);
    }
    // Use relative path for symlink
    const logBasename = LOG_FILE.split('/').pop();
    symlinkSync(logBasename, LATEST_LOG_LINK);
  } catch (err) {
    // Symlink may fail on some systems, not critical
    console.log(`\n⚠️  Could not create symlink: ${err.message}`);
  }

  const logBasename = LOG_FILE.split('/').pop();
  console.log(`\n📝 Results logged to: skills/${logBasename}`);
  console.log(`   Latest link: skills/test-runs-latest.log`);

  return { totalPassed, totalFailed, totalTests };
}

async function main() {
  const args = process.argv.slice(2);
  const suiteArg = args[0] || 'all';

  // Determine which suites to run (as sequential stages with optional parallelism)
  let suitesPlan;
  if (GROUPS[suiteArg]) {
    suitesPlan = GROUPS[suiteArg];
  } else if (SUITES[suiteArg]) {
    suitesPlan = [[suiteArg]];
  } else {
    console.error(`Unknown suite or group: ${suiteArg}`);
    console.log('\nAvailable suites:', Object.keys(SUITES).join(', '));
    console.log('Available groups:', Object.keys(GROUPS).join(', '));
    process.exit(1);
  }

  // Normalize plan to always be array-of-arrays
  suitesPlan = suitesPlan.map(stage => Array.isArray(stage) ? stage : [stage]);

  const logBasename = LOG_FILE.split('/').pop();
  const stageDescription = suitesPlan
    .map(stage => stage.length > 1 ? `(${stage.join(' + ')})` : stage[0])
    .join(' -> ');
  console.log(`\n🚀 Test Runner - Starting ${suitesPlan.flat().length} suite(s)`);
  console.log(`   Plan: ${stageDescription}`);
  const expectedTimes = suitesPlan
    .map(stage => stage.map(s => SUITES[s].expectedDuration).join(' + '))
    .join(' -> ');
  console.log(`   Expected per stage: ${expectedTimes}`);
  console.log(`   Log file: skills/${logBasename}\n`);

  const overallStart = Date.now();
  const results = [];

  for (const stage of suitesPlan) {
    const stageLabel = stage.join(' + ');
    console.log(`\n⏱️  Stage: ${stageLabel} (running ${stage.length} in parallel)`);

    const stageResults = await Promise.all(stage.map(runSuite));
    results.push(...stageResults);

    if (stageResults.some(r => !r.success) && suitesPlan.length > 1) {
      console.log(`\n⚠️  Stage "${stageLabel}" had failures. Continuing with remaining stages...`);
    }
  }

  const totalDuration = Date.now() - overallStart;
  const { totalPassed, totalFailed, totalTests } = logResults(results, totalDuration);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 FINAL SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Total Duration: ${formatDuration(totalDuration)}`);
  console.log(`   Tests:          ${totalPassed}/${totalTests} passed`);

  if (totalFailed > 0) {
    console.log(`   ❌ ${totalFailed} FAILED`);
    process.exit(1);
  } else {
    console.log(`   ✅ ALL TESTS PASSED`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
