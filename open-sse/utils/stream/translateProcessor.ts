import { translateResponse } from "../../translator/index.ts";
import { FORMATS } from "../../translator/formats.ts";
import {
  hasValidUsage,
  estimateUsage,
  addBufferToUsage,
  filterUsageForFormat,
  extractUsage,
} from "../usageTracking.ts";
import { parseSSELine, hasValuableContent, formatSSE } from "../streamHelpers.ts";

interface MutableRef<T> {
  current: T;
}

interface ProcessTranslateLineOptions {
  line: string;
  trimmed: string;
  targetFormat: string;
  sourceFormat: string;
  state: any;
  body: any;
  reqLogger: any;
  doneSentRef: MutableRef<boolean>;
  totalContentLengthRef: MutableRef<number>;
  enqueueOutput: (output: string) => void;
}

function trackParsedContentLength(parsed: any, totalContentLengthRef: MutableRef<number>) {
  // Claude format
  if (parsed.delta?.text) {
    totalContentLengthRef.current += parsed.delta.text.length;
  }
  if (parsed.delta?.thinking) {
    totalContentLengthRef.current += parsed.delta.thinking.length;
  }

  // OpenAI format
  if (parsed.choices?.[0]?.delta?.content) {
    totalContentLengthRef.current += parsed.choices[0].delta.content.length;
  }
  if (parsed.choices?.[0]?.delta?.reasoning_content) {
    totalContentLengthRef.current += parsed.choices[0].delta.reasoning_content.length;
  }

  // Gemini format
  if (parsed.candidates?.[0]?.content?.parts) {
    for (const part of parsed.candidates[0].content.parts) {
      if (part.text && typeof part.text === "string") {
        totalContentLengthRef.current += part.text.length;
      }
    }
  }
}

function logOpenAIIntermediateChunks(translated: any, reqLogger: any) {
  if ((translated as any)?._openaiIntermediate) {
    for (const item of (translated as any)._openaiIntermediate) {
      const openaiOutput = formatSSE(item, FORMATS.OPENAI);
      reqLogger?.appendOpenAIChunk?.(openaiOutput);
    }
  }
}

function enqueueTranslatedItems(options: {
  translated: any[];
  sourceFormat: string;
  state: any;
  body: any;
  totalContentLengthRef: MutableRef<number>;
  reqLogger: any;
  enqueueOutput: (output: string) => void;
}) {
  const { translated, sourceFormat, state, body, totalContentLengthRef, reqLogger, enqueueOutput } =
    options;

  for (const item of translated) {
    if (!hasValuableContent(item, sourceFormat)) {
      continue;
    }

    const isFinishChunk = item.type === "message_delta" || item.choices?.[0]?.finish_reason;
    if (state.finishReason && isFinishChunk && !hasValidUsage(item.usage) && totalContentLengthRef.current > 0) {
      const estimated = estimateUsage(body, totalContentLengthRef.current, sourceFormat);
      item.usage = filterUsageForFormat(estimated, sourceFormat);
      state.usage = estimated;
    } else if (state.finishReason && isFinishChunk && state.usage) {
      const buffered = addBufferToUsage(state.usage);
      item.usage = filterUsageForFormat(buffered, sourceFormat);
    }

    const output = formatSSE(item, sourceFormat);
    reqLogger?.appendConvertedChunk?.(output);
    enqueueOutput(output);
  }
}

export function processTranslateLine(options: ProcessTranslateLineOptions) {
  const {
    trimmed,
    targetFormat,
    sourceFormat,
    state,
    body,
    reqLogger,
    doneSentRef,
    totalContentLengthRef,
    enqueueOutput,
  } = options;

  if (!trimmed) return;

  const parsed = parseSSELine(trimmed);
  if (!parsed) return;

  if (parsed && parsed.done) {
    if (!doneSentRef.current) {
      doneSentRef.current = true;
      const output = "data: [DONE]\n\n";
      reqLogger?.appendConvertedChunk?.(output);
      enqueueOutput(output);
    }
    return;
  }

  trackParsedContentLength(parsed, totalContentLengthRef);

  const extracted = extractUsage(parsed);
  if (extracted) state.usage = extracted;

  const translated = translateResponse(targetFormat, sourceFormat, parsed, state);
  logOpenAIIntermediateChunks(translated, reqLogger);

  if (translated?.length > 0) {
    enqueueTranslatedItems({
      translated,
      sourceFormat,
      state,
      body,
      totalContentLengthRef,
      reqLogger,
      enqueueOutput,
    });
  }
}

export function processTranslateFlush(options: {
  buffer: string;
  targetFormat: string;
  sourceFormat: string;
  state: any;
  reqLogger: any;
  enqueueOutput: (output: string) => void;
}) {
  const { buffer, targetFormat, sourceFormat, state, reqLogger, enqueueOutput } = options;

  if (buffer.trim()) {
    const parsed = parseSSELine(buffer.trim());
    if (parsed && !parsed.done) {
      const translated = translateResponse(targetFormat, sourceFormat, parsed, state);

      if ((translated as any)?._openaiIntermediate) {
        for (const item of (translated as any)._openaiIntermediate) {
          const openaiOutput = formatSSE(item, FORMATS.OPENAI);
          reqLogger?.appendOpenAIChunk?.(openaiOutput);
        }
      }

      if (translated?.length > 0) {
        for (const item of translated) {
          const output = formatSSE(item, sourceFormat);
          reqLogger?.appendConvertedChunk?.(output);
          enqueueOutput(output);
        }
      }
    }
  }

  const flushed = translateResponse(targetFormat, sourceFormat, null, state);

  if ((flushed as any)?._openaiIntermediate) {
    for (const item of (flushed as any)._openaiIntermediate) {
      const openaiOutput = formatSSE(item, FORMATS.OPENAI);
      reqLogger?.appendOpenAIChunk?.(openaiOutput);
    }
  }

  if (flushed?.length > 0) {
    for (const item of flushed) {
      const output = formatSSE(item, sourceFormat);
      reqLogger?.appendConvertedChunk?.(output);
      enqueueOutput(output);
    }
  }
}
