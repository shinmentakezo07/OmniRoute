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
  let activityCount = 0;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    if (timeoutMs <= 0 || timer) return;

    // Optimize check interval based on timeout duration
    const optimizedInterval = Math.min(checkIntervalMs, Math.max(1000, timeoutMs / 4));

    timer = setInterval(() => {
      if (timedOut) return;
      if (Date.now() - lastChunkTime > timeoutMs) {
        timedOut = true;
        stop();
        onTimeout();
      }
    }, optimizedInterval);
  }

  function markActivity() {
    if (timedOut) return;
    lastChunkTime = Date.now();
    activityCount++;
  }

  function isTimedOut() {
    return timedOut;
  }

  function getActivityCount() {
    return activityCount;
  }

  function getIdleDuration() {
    return Date.now() - lastChunkTime;
  }

  return {
    start,
    stop,
    markActivity,
    isTimedOut,
    getActivityCount,
    getIdleDuration,
  };
}
