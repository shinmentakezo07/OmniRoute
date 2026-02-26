import test from "node:test";
import assert from "node:assert/strict";

import {
  openaiToOpenAIResponsesResponse,
  openaiResponsesToOpenAIResponse,
} from "../../open-sse/translator/response/openai-responses.ts";
import { initState } from "../../open-sse/translator/index.ts";
import { FORMATS } from "../../open-sse/translator/formats.ts";

function makeOpenAIResponsesState() {
  return initState(FORMATS.OPENAI_RESPONSES);
}

test("openaiToOpenAIResponsesResponse emits created/in_progress then content deltas", () => {
  const state = makeOpenAIResponsesState();

  const events = openaiToOpenAIResponsesResponse(
    {
      id: "chatcmpl_abc",
      choices: [
        {
          index: 0,
          delta: {
            reasoning_content: "hidden",
            content: "visible",
          },
          finish_reason: null,
        },
      ],
    },
    state
  );

  assert.equal(events[0].event, "response.created");
  assert.equal(events[1].event, "response.in_progress");

  const eventTypes = events.map((e) => e.event);
  assert.ok(eventTypes.includes("response.reasoning_summary_text.delta"));
  assert.ok(eventTypes.includes("response.output_text.delta"));

  for (const evt of events) {
    assert.ok(typeof evt.data.sequence_number === "number");
  }
});

test("openaiToOpenAIResponsesResponse handles tool call delta and emits completed on finish", () => {
  const state = makeOpenAIResponsesState();

  const first = openaiToOpenAIResponsesResponse(
    {
      id: "chatcmpl_tool",
      choices: [
        {
          index: 0,
          delta: {
            content: "need tool",
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "search", arguments: "{\"q\":\"docs\"}" },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    state
  );

  assert.ok(first.some((e) => e.event === "response.function_call_arguments.delta"));

  const finish = openaiToOpenAIResponsesResponse(
    {
      id: "chatcmpl_tool",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "tool_calls",
        },
      ],
    },
    state
  );

  assert.ok(finish.some((e) => e.event === "response.function_call_arguments.done"));
  assert.ok(finish.some((e) => e.event === "response.output_item.done"));
  assert.ok(finish.some((e) => e.event === "response.completed"));
});

test("openaiToOpenAIResponsesResponse flushes pending state when chunk is null", () => {
  const state = makeOpenAIResponsesState();

  openaiToOpenAIResponsesResponse(
    {
      id: "chatcmpl_flush",
      choices: [
        {
          index: 0,
          delta: { content: "hello" },
          finish_reason: null,
        },
      ],
    },
    state
  );

  const flush = openaiToOpenAIResponsesResponse(null, state);
  assert.ok(flush.some((e) => e.event === "response.output_text.done"));
  assert.ok(flush.some((e) => e.event === "response.completed"));
});

test("openaiResponsesToOpenAIResponse converts text/tool events and final usage", () => {
  const state = makeOpenAIResponsesState();

  const textChunk = openaiResponsesToOpenAIResponse(
    {
      type: "response.output_text.delta",
      delta: "hi",
    },
    state
  );
  assert.equal(textChunk.object, "chat.completion.chunk");
  assert.equal(textChunk.choices[0].delta.content, "hi");

  const toolStart = openaiResponsesToOpenAIResponse(
    {
      type: "response.output_item.added",
      item: {
        type: "function_call",
        call_id: "call_2",
        name: "lookup",
      },
    },
    state
  );
  assert.equal(toolStart.choices[0].delta.tool_calls[0].id, "call_2");
  assert.equal(toolStart.choices[0].delta.tool_calls[0].function.name, "lookup");

  const toolDelta = openaiResponsesToOpenAIResponse(
    {
      type: "response.function_call_arguments.delta",
      delta: '{"q":"x"}',
    },
    state
  );
  assert.equal(toolDelta.choices[0].delta.tool_calls[0].function.arguments, '{"q":"x"}');

  const done = openaiResponsesToOpenAIResponse(
    {
      type: "response.completed",
      response: {
        usage: {
          input_tokens: 10,
          output_tokens: 4,
          cache_read_input_tokens: 2,
          cache_creation_input_tokens: 1,
        },
      },
    },
    state
  );

  assert.equal(done.choices[0].finish_reason, "stop");
  assert.equal(done.usage.prompt_tokens, 13);
  assert.equal(done.usage.completion_tokens, 4);
  assert.equal(done.usage.total_tokens, 17);
  assert.equal(done.usage.prompt_tokens_details.cached_tokens, 2);
  assert.equal(done.usage.prompt_tokens_details.cache_creation_tokens, 1);
});

