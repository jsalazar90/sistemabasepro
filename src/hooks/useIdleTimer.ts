import { useState, useEffect, useRef, useCallback } from 'react';

interface UseIdleTimerOptions {
  timeoutMinutes?: number;
  onIdle?: () => void;
  enabled?: boolean;
}

export function useIdleTimer({
  timeoutMinutes = 15,
  onIdle,
  enabled = true
}: UseIdleTimerOptions = {}) {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const lock = useCallback(() => {
    setIsLocked(true);
    if (onIdle) onIdle();
  }, [onIdle]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    resetTimer();
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (enabled && !isLocked) {
      timerRef.current = setTimeout(() => {
        lock();
      }, timeoutMs);
    }
  }, [enabled, isLocked, lock, timeoutMs]);

  useEffect(() => {
    if (!enabled || isLocked) return;

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, isLocked, resetTimer]);

  return {
    isLocked,
    lock,
    unlock
  };
}
