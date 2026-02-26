// Gemini helper functions for translator

import {
  UNSUPPORTED_SCHEMA_CONSTRAINTS,
  cleanJSONSchemaForAntigravity,
} from "./geminiSchemaTransforms.ts";
import { convertOpenAIContentToParts, extractTextContent, tryParseJSON } from "./geminiContentTransforms.ts";

export { UNSUPPORTED_SCHEMA_CONSTRAINTS, cleanJSONSchemaForAntigravity };
export { convertOpenAIContentToParts, extractTextContent, tryParseJSON };

// Default safety settings
export const DEFAULT_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "OFF" },
];

// Generate request ID
export function generateRequestId() {
  return `agent-${crypto.randomUUID()}`;
}

// Generate session ID
export function generateSessionId() {
  return `-${Math.floor(Math.random() * 9000000000000000000)}`;
}

// Generate project ID
export function generateProjectId() {
  const adjectives = ["useful", "bright", "swift", "calm", "bold"];
  const nouns = ["fuze", "wave", "spark", "flow", "core"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}-${crypto.randomUUID().slice(0, 5)}`;
}
