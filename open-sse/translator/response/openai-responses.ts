/**
 * Translator: OpenAI Chat Completions ↔ OpenAI Responses API (response)
 */
import { register } from "../index.ts";
import { FORMATS } from "../formats.ts";
import { openaiToOpenAIResponsesResponse } from "./openai-responses.to-responses.ts";
import { openaiResponsesToOpenAIResponse } from "./openai-responses.to-openai.ts";

export { openaiToOpenAIResponsesResponse, openaiResponsesToOpenAIResponse };

// Register both directions
register(FORMATS.OPENAI, FORMATS.OPENAI_RESPONSES, null, openaiToOpenAIResponsesResponse);
register(FORMATS.OPENAI_RESPONSES, FORMATS.OPENAI, null, openaiResponsesToOpenAIResponse);
