import { FORMATS } from "../../translator/formats.ts";
import {
  extractUsage,
  hasValidUsage,
  estimateUsage,
  addBufferToUsage,
  filterUsageForFormat,
} from "../usageTracking.ts";
import { hasValuableContent, fixInvalidId } from "../streamHelpers.ts";
import {
  sanitizeStreamingChunk,
  extractThinkingFromContent,
} from "../../handlers/responseSanitizer.ts";

interface MutableRef<T> {
  current: T;
}

interface ProcessPassthroughLineOptions {
  line: string;
  trimmed: string;
  usageRef: MutableRef<any>;
  totalContentLengthRef: MutableRef<number>;
  body: any;
  reqLogger: any;
  enqueueOutput: (output: string) => void;
}

export function processPassthroughLine(options: ProcessPassthroughLineOptions) {
  const { line, trimmed, usageRef, totalContentLengthRef, body, reqLogger, enqueueOutput } = options;

  let output;
  let injectedUsage = false;

  if (trimmed.startsWith("data:") && trimmed.slice(5).trim() !== "[DONE]") {
    try {
      let parsed = JSON.parse(trimmed.slice(5).trim());

      // Sanitize: strip non-standard fields for OpenAI SDK compatibility
      parsed = sanitizeStreamingChunk(parsed);

      const idFixed = fixInvalidId(parsed);

      if (!hasValuableContent(parsed, FORMATS.OPENAI)) {
        return;
      }

      const delta = parsed.choices?.[0]?.delta;

      // Extract <think> tags from streaming content
      if (delta?.content && typeof delta.content === "string") {
        const { content, thinking } = extractThinkingFromContent(delta.content);
        delta.content = content;
        if (thinking && !delta.reasoning_content) {
          delta.reasoning_content = thinking;
        }
      }

      const content = delta?.content || delta?.reasoning_content;
      if (content && typeof content === "string") {
        totalContentLengthRef.current += content.length;
      }

      const extracted = extractUsage(parsed);
      if (extracted) {
        usageRef.current = extracted;
      }

      const isFinishChunk = parsed.choices?.[0]?.finish_reason;
      if (isFinishChunk && !hasValidUsage(parsed.usage)) {
        const estimated = estimateUsage(body, totalContentLengthRef.current, FORMATS.OPENAI);
        parsed.usage = filterUsageForFormat(estimated, FORMATS.OPENAI);
        output = `data: ${JSON.stringify(parsed)}\n`;
        usageRef.current = estimated;
        injectedUsage = true;
      } else if (isFinishChunk && usageRef.current) {
        const buffered = addBufferToUsage(usageRef.current);
        parsed.usage = filterUsageForFormat(buffered, FORMATS.OPENAI);
        output = `data: ${JSON.stringify(parsed)}\n`;
        injectedUsage = true;
      } else if (idFixed) {
        output = `data: ${JSON.stringify(parsed)}\n`;
        injectedUsage = true;
      }
    } catch {}
  }

  if (!injectedUsage) {
    if (line.startsWith("data:") && !line.startsWith("data: ")) {
      output = "data: " + line.slice(5) + "\n";
    } else {
      output = line + "\n";
    }
  }

  reqLogger?.appendConvertedChunk?.(output);
  enqueueOutput(output);
}
