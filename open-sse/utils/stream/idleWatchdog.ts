export interface IdleWatchdogOptions {
  timeoutMs: number;
  checkIntervalMs?: number;
  onTimeout: () => void;
}

/**
 * Tracks stream idle time and invokes onTimeout once when no activity
 * is observed for timeoutMs.
 */
export function createIdleWatchdog(options: IdleWatchdogOptions) {
  const { timeoutMs, checkIntervalMs = 10_000, onTimeout } = options;

  let lastChunkTime = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let timedOut = false;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    if (timeoutMs <= 0 || timer) return;

    timer = setInterval(() => {
      if (timedOut) return;
      if (Date.now() - lastChunkTime > timeoutMs) {
        timedOut = true;
        stop();
        onTimeout();
      }
    }, checkIntervalMs);
  }

  function markActivity() {
    if (timedOut) return;
    lastChunkTime = Date.now();
  }

  function isTimedOut() {
    return timedOut;
  }

  return {
    start,
    stop,
    markActivity,
    isTimedOut,
  };
}
