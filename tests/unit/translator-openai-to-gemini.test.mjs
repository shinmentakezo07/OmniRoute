import test from "node:test";
import assert from "node:assert/strict";

import {
  openaiToGeminiRequest,
  openaiToGeminiCLIRequest,
  openaiToAntigravityRequest,
} from "../../open-sse/translator/request/openai-to-gemini.ts";
import { ANTIGRAVITY_DEFAULT_SYSTEM } from "../../open-sse/config/constants.ts";

test("openaiToGeminiRequest preserves core message/tool/format mapping", () => {
  const body = {
    temperature: 0.3,
    top_p: 0.9,
    top_k: 20,
    max_tokens: 256,
    messages: [
      { role: "system", content: "System policy" },
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "image_url", image_url: { url: "data:image/png;base64,ABC123" } },
        ],
      },
      {
        role: "assistant",
        reasoning_content: "hidden-thought",
        content: "assistant text",
        tool_calls: [
          {
            id: "call_search_1",
            type: "function",
            function: { name: "search", arguments: '{"q":"docs"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_search_1", content: '{"ok":true}' },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "search",
          description: "Search docs",
          parameters: {
            type: "object",
            properties: { q: { type: "string" } },
            required: ["q"],
          },
        },
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        schema: {
          type: "object",
          $schema: "https://json-schema.org/draft/2020-12/schema",
          additionalProperties: false,
          properties: { answer: { type: "string" } },
          required: ["answer"],
        },
      },
    },
  };

  const result = openaiToGeminiRequest("gemini-2.0-flash", body, true);

  assert.equal(result.model, "gemini-2.0-flash");
  assert.equal(result.generationConfig.temperature, 0.3);
  assert.equal(result.generationConfig.topP, 0.9);
  assert.equal(result.generationConfig.topK, 20);
  assert.equal(result.generationConfig.maxOutputTokens, 256);

  assert.equal(result.systemInstruction.role, "user");
  assert.equal(result.systemInstruction.parts[0].text, "System policy");

  const userTextPart = result.contents[0].parts.find((p) => p.text === "hello");
  assert.ok(userTextPart);

  const userImagePart = result.contents[0].parts.find((p) => p.inlineData);
  assert.equal(userImagePart.inlineData.mime_type, "image/png");
  assert.equal(userImagePart.inlineData.data, "ABC123");

  const assistantParts = result.contents[1].parts;
  assert.ok(assistantParts.find((p) => p.thought === true && p.text === "hidden-thought"));
  assert.ok(assistantParts.find((p) => p.functionCall?.name === "search"));

  const toolResponsePart = result.contents[2].parts.find((p) => p.functionResponse);
  assert.equal(toolResponsePart.functionResponse.id, "call_search_1");
  assert.equal(toolResponsePart.functionResponse.name, "search");
  assert.deepEqual(toolResponsePart.functionResponse.response.result, { ok: true });

  assert.equal(result.tools[0].functionDeclarations[0].name, "search");
  assert.equal(result.generationConfig.responseMimeType, "application/json");
  assert.equal(result.generationConfig.responseSchema.$schema, undefined);
  assert.equal(result.generationConfig.responseSchema.additionalProperties, undefined);
});

test("openaiToGeminiCLIRequest applies thinking config and schema cleanup", () => {
  const body = {
    reasoning_effort: "high",
    messages: [{ role: "user", content: "hi" }],
    tools: [
      {
        type: "function",
        function: {
          name: "toolA",
          description: "A tool",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              mode: { const: 1 },
              value: { type: "string", minLength: 2 },
            },
            required: ["mode", "missing"],
          },
        },
      },
    ],
  };

  const result = openaiToGeminiCLIRequest("gemini-2.0-flash", body, true);

  assert.equal(result.generationConfig.thinkingConfig.thinkingBudget, 32768);
  assert.equal(result.generationConfig.thinkingConfig.include_thoughts, true);

  const schema = result.tools[0].functionDeclarations[0].parameters;
  const serialized = JSON.stringify(schema);
  assert.equal(serialized.includes("minLength"), false);
  assert.equal(serialized.includes("additionalProperties"), false);
  assert.deepEqual(schema.properties.mode.enum, ["1"]);
  assert.equal(schema.properties.mode.const, undefined);
  assert.deepEqual(schema.required, ["mode"]);
});

test("openaiToAntigravityRequest (Claude model) uses Claude envelope path", () => {
  const body = {
    system: "Use tools safely",
    messages: [{ role: "user", content: "hello" }],
    tools: [
      {
        type: "function",
        function: {
          name: "lookup",
          description: "Lookup",
          parameters: { type: "object", properties: { q: { type: "string" } } },
        },
      },
    ],
  };

  const result = openaiToAntigravityRequest("claude-sonnet-4-5", body, true, {
    projectId: "proj-test",
  });

  assert.equal(result.userAgent, "antigravity");
  assert.equal(result.requestType, "agent");
  assert.equal(result.project, "proj-test");
  assert.match(result.requestId, /^agent-/);
  assert.equal(result.request.toolConfig.functionCallingConfig.mode, "VALIDATED");
  assert.equal(result.request.systemInstruction.parts[0].text, ANTIGRAVITY_DEFAULT_SYSTEM);
});

test("openaiToAntigravityRequest (Gemini model) uses Gemini CLI envelope path", () => {
  const body = {
    messages: [
      { role: "system", content: "extra system" },
      { role: "user", content: "hello" },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "lookup",
          description: "Lookup",
          parameters: { type: "object", properties: {} },
        },
      },
    ],
  };

  const result = openaiToAntigravityRequest("gemini-2.5-pro", body, true, {
    projectId: "proj-gemini",
  });

  assert.equal(result.userAgent, "antigravity");
  assert.equal(result.requestType, "agent");
  assert.equal(result.project, "proj-gemini");
  assert.equal(result.request.safetySettings, undefined);
  assert.equal(result.request.toolConfig.functionCallingConfig.mode, "VALIDATED");
  assert.equal(result.request.systemInstruction.parts[0].text, ANTIGRAVITY_DEFAULT_SYSTEM);
});
