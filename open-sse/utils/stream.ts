import { initState } from "../translator/index.ts";
import { STREAM_IDLE_TIMEOUT_MS, HTTP_STATUS } from "../config/constants.ts";
import { trackPendingRequest, appendRequestLog } from "@/lib/usageDb";
import { COLORS } from "./usageTracking.ts";
import { formatSSE } from "./streamHelpers.ts";
import { createIdleWatchdog } from "./stream/idleWatchdog.ts";
import { processPassthroughLine } from "./stream/passthroughProcessor.ts";
import { processTranslateLine } from "./stream/translateProcessor.ts";
import { beginFlush, handlePassthroughFlush, handleTranslateFlush } from "./stream/flushHandlers.ts";

export { COLORS, formatSSE };

// Note: TextDecoder/TextEncoder are created per-stream inside createSSEStream()
// to avoid shared state issues with concurrent streams (TextDecoder with {stream:true}
// maintains internal buffering state between decode() calls).

/**
 * Stream modes
 */
const STREAM_MODE = {
  TRANSLATE: "translate", // Full translation between formats
  PASSTHROUGH: "passthrough", // No translation, normalize output, extract usage
};

/**
 * Create unified SSE transform stream with idle timeout protection.
 * If the upstream provider stops sending data for STREAM_IDLE_TIMEOUT_MS,
 * the stream emits an error event and closes to prevent indefinite hanging.
 *
 * @param {object} options
 * @param {string} options.mode - Stream mode: translate, passthrough
 * @param {string} options.targetFormat - Provider format (for translate mode)
 * @param {string} options.sourceFormat - Client format (for translate mode)
 * @param {string} options.provider - Provider name
 * @param {object} options.reqLogger - Request logger instance
 * @param {string} options.model - Model name
 * @param {string} options.connectionId - Connection ID for usage tracking
 * @param {object|null} options.apiKeyInfo - API key metadata for usage attribution
 * @param {object} options.body - Request body (for input token estimation)
 * @param {function} options.onComplete - Callback when stream finishes: ({ status, usage }) => void
 */
/** @param {any} options */
export function createSSEStream(options: any = {}) {
  const {
    mode = STREAM_MODE.TRANSLATE,
    targetFormat,
    sourceFormat,
    provider = null,
    reqLogger = null,
    /** @type {any} */
    toolNameMap = null,
    model = null,
    connectionId = null,
    apiKeyInfo = null,
    body = null,
    onComplete = null,
  } = options;

  // Mutable refs shared across helpers
  const bufferRef = { current: "" };
  const usageRef = { current: null };
  const totalContentLengthRef = { current: 0 };
  const doneSentRef = { current: false };

  // State for translate mode
  const state =
    mode === STREAM_MODE.TRANSLATE ? { ...initState(sourceFormat), provider, toolNameMap } : null;

  // Per-stream instances to avoid shared state with concurrent streams
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // Idle timeout state — closes stream if provider stops sending data
  let streamTimedOut = false;
  let streamController = null;
  const idleWatchdog = createIdleWatchdog({
    timeoutMs: STREAM_IDLE_TIMEOUT_MS,
    onTimeout: () => {
      streamTimedOut = true;
      const timeoutMsg = `[STREAM] Idle timeout: no data from ${provider || "provider"} for ${STREAM_IDLE_TIMEOUT_MS}ms (model: ${model || "unknown"})`;
      console.warn(timeoutMsg);
      trackPendingRequest(model, provider, connectionId, false);
      appendRequestLog({
        model,
        provider,
        connectionId,
        status: `FAILED ${HTTP_STATUS.GATEWAY_TIMEOUT}`,
      }).catch(() => {});

      const timeoutError = new Error(timeoutMsg);
      timeoutError.name = "StreamIdleTimeoutError";
      streamController?.error(timeoutError);
    },
  });

  return new TransformStream(
    {
      start(controller) {
        streamController = controller;
        idleWatchdog.start();
      },

      transform(chunk, controller) {
        if (streamTimedOut) return;

        idleWatchdog.markActivity();

        const text = decoder.decode(chunk, { stream: true });
        bufferRef.current += text;
        reqLogger?.appendProviderChunk?.(text);

        const lines = bufferRef.current.split("\n");
        bufferRef.current = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (mode === STREAM_MODE.PASSTHROUGH) {
            processPassthroughLine({
              line,
              trimmed,
              usageRef,
              totalContentLengthRef,
              body,
              reqLogger,
              enqueueOutput: (output) => controller.enqueue(encoder.encode(output)),
            });
            continue;
          }

          processTranslateLine({
            line,
            trimmed,
            targetFormat,
            sourceFormat,
            state,
            body,
            reqLogger,
            doneSentRef,
            totalContentLengthRef,
            enqueueOutput: (output) => controller.enqueue(encoder.encode(output)),
          });
        }
      },

      flush(controller) {
        idleWatchdog.stop();
        if (streamTimedOut) return;

        beginFlush(model, provider, connectionId);

        try {
          if (mode === STREAM_MODE.PASSTHROUGH) {
            handlePassthroughFlush({
              decoder,
              encoder,
              reqLogger,
              provider,
              model,
              connectionId,
              apiKeyInfo,
              body,
              onComplete,
              totalContentLengthRef,
              bufferRef,
              usageRef,
              enqueueBytes: (value) => controller.enqueue(value),
            });
            return;
          }

          handleTranslateFlush({
            decoder,
            encoder,
            reqLogger,
            provider,
            model,
            connectionId,
            apiKeyInfo,
            body,
            onComplete,
            totalContentLengthRef,
            bufferRef,
            doneSentRef,
            targetFormat,
            sourceFormat,
            state,
            enqueueBytes: (value) => controller.enqueue(value),
          });
        } catch (error) {
          console.log(`[STREAM] Error in flush (${model || "unknown"}):`, error.message || error);
        }
      },
    },
    // Writable side backpressure — limit buffered chunks to avoid unbounded memory
    { highWaterMark: 16 },
    // Readable side backpressure — limit queued output chunks
    { highWaterMark: 16 }
  );
}

// Convenience functions for backward compatibility
export function createSSETransformStreamWithLogger(
  targetFormat,
  sourceFormat,
  provider = null,
  reqLogger = null,
  toolNameMap = null,
  model = null,
  connectionId = null,
  body = null,
  onComplete = null,
  apiKeyInfo = null
) {
  return createSSEStream({
    mode: STREAM_MODE.TRANSLATE,
    targetFormat,
    sourceFormat,
    provider,
    reqLogger,
    toolNameMap,
    model,
    connectionId,
    apiKeyInfo,
    body,
    onComplete,
  });
}

export function createPassthroughStreamWithLogger(
  provider = null,
  reqLogger = null,
  model = null,
  connectionId = null,
  body = null,
  onComplete = null,
  apiKeyInfo = null
) {
  return createSSEStream({
    mode: STREAM_MODE.PASSTHROUGH,
    provider,
    reqLogger,
    model,
    connectionId,
    apiKeyInfo,
    body,
    onComplete,
  });
}
