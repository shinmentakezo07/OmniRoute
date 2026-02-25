import test from "node:test";
import assert from "node:assert/strict";

import { createSSEStream } from "../../open-sse/utils/stream.ts";
import { FORMATS } from "../../open-sse/translator/formats.ts";

async function runStream(options, chunks) {
  const transform = createSSEStream(options);
  const writer = transform.writable.getWriter();
  const reader = transform.readable.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  for (const chunk of chunks) {
    await writer.write(encoder.encode(chunk));
  }
  await writer.close();

  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  return output;
}

function extractJsonEvents(output) {
  return output
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => line.slice(6).trim())
    .map((payload) => {
      try {
        return JSON.parse(payload);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

test("translate mode emits [DONE] exactly once", async () => {
  const output = await runStream(
    {
      mode: "translate",
      targetFormat: FORMATS.OPENAI,
      sourceFormat: FORMATS.OPENAI,
      provider: "openai",
      model: "gpt-4o",
      connectionId: "conn-translate-done",
      body: { messages: [{ role: "user", content: "hello" }] },
    },
    [
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n",
    ]
  );

  const doneMatches = output.match(/data: \[DONE\]/g) || [];
  assert.equal(doneMatches.length, 1);
});

test("passthrough mode normalizes data prefix spacing", async () => {
  const output = await runStream(
    {
      mode: "passthrough",
      provider: "openai",
      model: "gpt-4o",
      connectionId: "conn-prefix-normalize",
    },
    [
      'data:{"id":"chatcmpl-12345678","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
    ]
  );

  assert.match(output, /data: \{"id":"chatcmpl-12345678"/);
  assert.equal(output.includes('data:{"id":"chatcmpl-12345678"'), false);
});

test("passthrough injects usage into finish chunk without synthetic usage event", async () => {
  const output = await runStream(
    {
      mode: "passthrough",
      provider: "openai",
      model: "gpt-4o",
      connectionId: "conn-usage-inject",
      body: { messages: [{ role: "user", content: "Say hello" }] },
    },
    [
      'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"hello world"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
    ]
  );

  const events = extractJsonEvents(output);
  assert.equal(events.length, 2);
  assert.ok(events[1].usage);
  assert.ok(events[1].usage.total_tokens >= 1);
  assert.equal(events.filter((e) => e.usage).length, 1);
});

test("passthrough extracts <think> tags when parsed chunk is re-serialized", async () => {
  const output = await runStream(
    {
      mode: "passthrough",
      provider: "openai",
      model: "gpt-4o",
      connectionId: "conn-think-extract",
    },
    [
      'data: {"id":"chat","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"<think>internal reasoning</think>final answer"},"finish_reason":null}]}\n\n',
    ]
  );

  const events = extractJsonEvents(output);
  assert.equal(events.length, 1);

  const delta = events[0].choices?.[0]?.delta;
  assert.equal(delta?.content, "final answer");
  assert.equal(delta?.reasoning_content, "internal reasoning");
});

test("passthrough fixes invalid generic ids to chatcmpl-*", async () => {
  const output = await runStream(
    {
      mode: "passthrough",
      provider: "openai",
      model: "gpt-4o",
      connectionId: "conn-id-fix",
    },
    [
      'data: {"id":"completion","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
    ]
  );

  const events = extractJsonEvents(output);
  assert.equal(events.length, 1);
  assert.match(events[0].id, /^chatcmpl-/);
}
);
