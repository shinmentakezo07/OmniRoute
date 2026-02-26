import test from "node:test";
import assert from "node:assert/strict";

import {
  convertOpenAIContentToParts,
  extractTextContent,
  tryParseJSON,
  cleanJSONSchemaForAntigravity,
} from "../../open-sse/translator/helpers/geminiHelper.ts";

test("convertOpenAIContentToParts converts text and base64 image_url", () => {
  const parts = convertOpenAIContentToParts([
    { type: "text", text: "hello" },
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,XYZ" } },
  ]);

  assert.equal(parts[0].text, "hello");
  assert.equal(parts[1].inlineData.mime_type, "image/jpeg");
  assert.equal(parts[1].inlineData.data, "XYZ");
});

test("extractTextContent concatenates only text blocks", () => {
  const text = extractTextContent([
    { type: "text", text: "a" },
    { type: "image_url", image_url: { url: "data:image/png;base64,AA" } },
    { type: "text", text: "b" },
  ]);

  assert.equal(text, "ab");
});

test("tryParseJSON parses valid JSON and returns null for invalid strings", () => {
  assert.deepEqual(tryParseJSON('{"ok":true}'), { ok: true });
  assert.equal(tryParseJSON("not-json"), null);
  assert.equal(tryParseJSON(123), 123);
});

test("cleanJSONSchemaForAntigravity applies transform pipeline with placeholder injection", () => {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: { const: 2 },
      nested: {
        anyOf: [{ type: "null" }, { type: "object", properties: {} }],
      },
      combo: {
        allOf: [
          { properties: { a: { type: "string", minLength: 3 } }, required: ["a"] },
          { properties: { b: { type: ["null", "number"] } }, required: ["b"] },
        ],
      },
    },
    required: ["mode", "missing"],
    oneOf: [
      { type: "null" },
      { type: "object", properties: { x: { type: "string" } }, required: ["x"] },
    ],
  };

  const cleaned = cleanJSONSchemaForAntigravity(schema);
  const serialized = JSON.stringify(cleaned);

  // Unsupported keys removed
  assert.equal(serialized.includes("additionalProperties"), false);
  assert.equal(serialized.includes("minLength"), false);
  assert.equal(serialized.includes("oneOf"), false);
  assert.equal(serialized.includes("anyOf"), false);
  assert.equal(serialized.includes("allOf"), false);

  // const -> enum(string)
  assert.deepEqual(cleaned.properties.mode.enum, ["2"]);
  assert.equal(cleaned.properties.mode.const, undefined);

  // required cleanup
  assert.deepEqual(cleaned.required, ["mode"]);

  // nested object placeholder
  assert.equal(cleaned.properties.nested.type, "object");
  assert.ok(cleaned.properties.nested.properties.reason);
  assert.deepEqual(cleaned.properties.nested.required, ["reason"]);

  // merged allOf and flattened type arrays
  assert.ok(cleaned.properties.combo.properties.a);
  assert.ok(cleaned.properties.combo.properties.b);
  assert.equal(cleaned.properties.combo.properties.b.type, "number");
});
