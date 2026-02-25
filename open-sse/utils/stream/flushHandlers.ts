import { FORMATS } from "../../translator/formats.ts";
import { trackPendingRequest, appendRequestLog } from "@/lib/usageDb";
import { hasValidUsage, estimateUsage, logUsage } from "../usageTracking.ts";
import { processTranslateFlush } from "./translateProcessor.ts";

interface MutableRef<T> {
  current: T;
}

interface SharedFlushOptions {
  decoder: TextDecoder;
  encoder: TextEncoder;
  reqLogger: any;
  provider: string | null;
  model: string | null;
  connectionId: string | null;
  apiKeyInfo: any;
  body: any;
  onComplete: ((result: { status: number; usage: any }) => void) | null;
  totalContentLengthRef: MutableRef<number>;
  enqueueBytes: (value: Uint8Array) => void;
}

export function handlePassthroughFlush(
  options: SharedFlushOptions & {
    bufferRef: MutableRef<string>;
    usageRef: MutableRef<any>;
  }
) {
  const {
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
    enqueueBytes,
  } = options;

  const remaining = decoder.decode();
  if (remaining) bufferRef.current += remaining;

  if (bufferRef.current) {
    let output = bufferRef.current;
    if (bufferRef.current.startsWith("data:") && !bufferRef.current.startsWith("data: ")) {
      output = "data: " + bufferRef.current.slice(5);
    }
    reqLogger?.appendConvertedChunk?.(output);
    enqueueBytes(encoder.encode(output));
  }

  if (!hasValidUsage(usageRef.current) && totalContentLengthRef.current > 0) {
    usageRef.current = estimateUsage(body, totalContentLengthRef.current, FORMATS.OPENAI);
  }

  if (hasValidUsage(usageRef.current)) {
    logUsage(provider, usageRef.current, model, connectionId, apiKeyInfo);
  } else {
    appendRequestLog({
      model,
      provider,
      connectionId,
      tokens: null,
      status: "200 OK",
    }).catch(() => {});
  }

  if (onComplete) {
    try {
      onComplete({ status: 200, usage: usageRef.current });
    } catch {}
  }
}

export function handleTranslateFlush(
  options: SharedFlushOptions & {
    bufferRef: MutableRef<string>;
    doneSentRef: MutableRef<boolean>;
    targetFormat: string;
    sourceFormat: string;
    state: any;
  }
) {
  const {
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
    enqueueBytes,
  } = options;

  const remaining = decoder.decode();
  if (remaining) bufferRef.current += remaining;

  processTranslateFlush({
    buffer: bufferRef.current,
    targetFormat,
    sourceFormat,
    state,
    reqLogger,
    enqueueOutput: (output) => enqueueBytes(encoder.encode(output)),
  });

  if (!doneSentRef.current) {
    doneSentRef.current = true;
    const doneOutput = "data: [DONE]\n\n";
    reqLogger?.appendConvertedChunk?.(doneOutput);
    enqueueBytes(encoder.encode(doneOutput));
  }

  if (!hasValidUsage(state?.usage) && totalContentLengthRef.current > 0) {
    state.usage = estimateUsage(body, totalContentLengthRef.current, sourceFormat);
  }

  if (hasValidUsage(state?.usage)) {
    logUsage(state.provider || targetFormat, state.usage, model, connectionId, apiKeyInfo);
  } else {
    appendRequestLog({ model, provider, connectionId, tokens: null, status: "200 OK" }).catch(
      () => {}
    );
  }

  if (onComplete) {
    try {
      onComplete({ status: 200, usage: state?.usage });
    } catch {}
  }
}

export function beginFlush(model: string | null, provider: string | null, connectionId: string | null) {
  trackPendingRequest(model, provider, connectionId, false);
}
