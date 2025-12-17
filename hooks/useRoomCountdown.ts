import { useState, useEffect, useRef } from 'react';

/**
 * Clock-skew safe countdown hook for room expiration.
 * Uses duration from server instead of absolute timestamp to avoid
 * issues with client/server clock differences.
 */
export function useRoomCountdown(roomExpiresInMs: number | undefined): number | null {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Track when we received this duration (only update if duration changed)
  const expirationReceivedAt = useRef<number | null>(null);
  const lastExpiresInMs = useRef<number | null>(null);

  useEffect(() => {
    if (roomExpiresInMs === undefined) {
      setTimeLeft(null);
      expirationReceivedAt.current = null;
      lastExpiresInMs.current = null;
      return;
    }

    // Only reset timer when the duration actually changes
    if (lastExpiresInMs.current !== roomExpiresInMs) {
      expirationReceivedAt.current = Date.now();
      lastExpiresInMs.current = roomExpiresInMs;
    }

    const updateTimer = () => {
      if (expirationReceivedAt.current === null || lastExpiresInMs.current === null) return;
      const elapsed = Date.now() - expirationReceivedAt.current;
      const remaining = Math.max(0, Math.ceil((lastExpiresInMs.current - elapsed) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [roomExpiresInMs]);

  return timeLeft;
}
