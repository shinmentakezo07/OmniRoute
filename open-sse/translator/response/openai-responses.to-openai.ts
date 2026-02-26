/**
 * Translate OpenAI Responses API chunk to OpenAI Chat Completions format
 * This is for when Codex returns data and we need to send it to an OpenAI-compatible client
 */
export function openaiResponsesToOpenAIResponse(chunk, state) {
  if (!chunk) {
    // Flush: send final chunk with finish_reason
    if (!state.finishReasonSent && state.started) {
      state.finishReasonSent = true;
      return {
        id: state.chatId || `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: state.created || Math.floor(Date.now() / 1000),
        model: state.model || "gpt-4",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      };
    }
    return null;
  }

  // Handle different event types from Responses API
  const eventType = chunk.type || chunk.event;
  const data = chunk.data || chunk;

  // Initialize state
  if (!state.started) {
    state.started = true;
    state.chatId = `chatcmpl-${Date.now()}`;
    state.created = Math.floor(Date.now() / 1000);
    state.toolCallIndex = 0;
    state.currentToolCallId = null;
  }

  // Text content delta
  if (eventType === "response.output_text.delta") {
    const delta = data.delta || "";
    if (!delta) return null;

    return {
      id: state.chatId,
      object: "chat.completion.chunk",
      created: state.created,
      model: state.model || "gpt-4",
      choices: [
        {
          index: 0,
          delta: { content: delta },
          finish_reason: null,
        },
      ],
    };
  }

  // Text content done (ignore, we handle via delta)
  if (eventType === "response.output_text.done") {
    return null;
  }

  // Function call started
  if (eventType === "response.output_item.added" && data.item?.type === "function_call") {
    const item = data.item;
    state.currentToolCallId = item.call_id || `call_${Date.now()}`;

    return {
      id: state.chatId,
      object: "chat.completion.chunk",
      created: state.created,
      model: state.model || "gpt-4",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: state.toolCallIndex,
                id: state.currentToolCallId,
                type: "function",
                function: {
                  name: item.name || "",
                  arguments: "",
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    };
  }

  // Function call arguments delta
  if (eventType === "response.function_call_arguments.delta") {
    const argsDelta = data.delta || "";
    if (!argsDelta) return null;

    return {
      id: state.chatId,
      object: "chat.completion.chunk",
      created: state.created,
      model: state.model || "gpt-4",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: state.toolCallIndex,
                function: { arguments: argsDelta },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    };
  }

  // Function call done
  if (eventType === "response.output_item.done" && data.item?.type === "function_call") {
    state.toolCallIndex++;
    return null;
  }

  // Response completed
  if (eventType === "response.completed") {
    // Extract usage from response.completed event
    const responseUsage = data.response?.usage;
    if (responseUsage && typeof responseUsage === "object") {
      const inputTokens = responseUsage.input_tokens || responseUsage.prompt_tokens || 0;
      const outputTokens = responseUsage.output_tokens || responseUsage.completion_tokens || 0;
      const cacheReadTokens = responseUsage.cache_read_input_tokens || 0;
      const cacheCreationTokens = responseUsage.cache_creation_input_tokens || 0;

      // prompt_tokens = input_tokens + cache_read + cache_creation (all prompt-side tokens)
      const promptTokens = inputTokens + cacheReadTokens + cacheCreationTokens;

      state.usage = {
        prompt_tokens: promptTokens,
        completion_tokens: outputTokens,
        total_tokens: promptTokens + outputTokens,
      };

      // Add prompt_tokens_details if cache tokens exist
      if (cacheReadTokens > 0 || cacheCreationTokens > 0) {
        state.usage.prompt_tokens_details = {};
        if (cacheReadTokens > 0) {
          state.usage.prompt_tokens_details.cached_tokens = cacheReadTokens;
        }
        if (cacheCreationTokens > 0) {
          state.usage.prompt_tokens_details.cache_creation_tokens = cacheCreationTokens;
        }
      }
    }

    if (!state.finishReasonSent) {
      state.finishReasonSent = true;
      state.finishReason = "stop"; // Mark for usage injection in stream.js

      const finalChunk: Record<string, any> = {
        id: state.chatId,
        object: "chat.completion.chunk",
        created: state.created,
        model: state.model || "gpt-4",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      };

      // Include usage in final chunk if available
      if (state.usage && typeof state.usage === "object") {
        finalChunk.usage = state.usage;
      }

      return finalChunk;
    }
    return null;
  }

  // Reasoning events (convert to content or skip)
  if (eventType === "response.reasoning_summary_text.delta") {
    // Optionally include reasoning as content, or skip
    return null;
  }

  // Ignore other events
  return null;
}
