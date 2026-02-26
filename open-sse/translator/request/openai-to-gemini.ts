import { register } from "../index.ts";
import { FORMATS } from "../formats.ts";
import { openaiToGeminiRequest, openaiToGeminiCLIRequest } from "./openai-to-gemini.base.ts";
import { openaiToAntigravityRequest, wrapInCloudCodeEnvelope } from "./openai-to-gemini.envelope.ts";

export { openaiToGeminiRequest, openaiToGeminiCLIRequest, openaiToAntigravityRequest };

// Register
register(FORMATS.OPENAI, FORMATS.GEMINI, openaiToGeminiRequest, null);
register(
  FORMATS.OPENAI,
  FORMATS.GEMINI_CLI,
  (model, body, stream, credentials) =>
    wrapInCloudCodeEnvelope(model, openaiToGeminiCLIRequest(model, body, stream), credentials),
  null
);
register(FORMATS.OPENAI, FORMATS.ANTIGRAVITY, openaiToAntigravityRequest, null);
