import test from "node:test";
import assert from "node:assert/strict";

import { createIdleWatchdog } from "../../open-sse/utils/stream/idleWatchdog.ts";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("idle watchdog triggers timeout exactly once", async () => {
  let timeouts = 0;
  const watchdog = createIdleWatchdog({
    timeoutMs: 25,
    checkIntervalMs: 5,
    onTimeout: () => {
      timeouts += 1;
    },
  });

  watchdog.start();
  await sleep(80);

  assert.equal(timeouts, 1);
  assert.equal(watchdog.isTimedOut(), true);
  watchdog.stop();
});

test("idle watchdog respects activity updates", async () => {
  let timeouts = 0;
  const watchdog = createIdleWatchdog({
    timeoutMs: 30,
    checkIntervalMs: 5,
    onTimeout: () => {
      timeouts += 1;
    },
  });

  watchdog.start();

  await sleep(12);
  watchdog.markActivity();
  await sleep(12);
  watchdog.markActivity();
  await sleep(12);
  watchdog.markActivity();

  assert.equal(timeouts, 0);
  assert.equal(watchdog.isTimedOut(), false);

  watchdog.stop();
  await sleep(40);
  assert.equal(timeouts, 0);
});
