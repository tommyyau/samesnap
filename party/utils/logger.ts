/**
 * Logging utility for PartyKit server.
 * Provides structured logging with log levels and consistent formatting.
 *
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.info(roomId, 'Player joined', { playerId, name });
 *
 * Log levels (from least to most severe):
 *   debug: 0 - Detailed debugging info (disabled in production)
 *   info:  1 - Normal operational messages
 *   warn:  2 - Warning conditions
 *   error: 3 - Error conditions
 *
 * Set LOG_LEVEL environment variable to control verbosity.
 * Default is 'info' which shows info, warn, and error.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[LOG_LEVEL];
}

function formatMessage(roomId: string, msg: string): string {
  return `[Room ${roomId}] ${msg}`;
}

export const logger = {
  debug: (roomId: string, msg: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log(formatMessage(roomId, msg), ...args);
    }
  },

  info: (roomId: string, msg: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      console.log(formatMessage(roomId, msg), ...args);
    }
  },

  warn: (roomId: string, msg: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage(roomId, msg), ...args);
    }
  },

  error: (roomId: string, msg: string, ...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(formatMessage(roomId, msg), ...args);
    }
  },
};
