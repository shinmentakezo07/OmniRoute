import { ANTIGRAVITY_DEFAULT_SYSTEM } from "../../config/constants.ts";
import { openaiToClaudeRequestForAntigravity } from "./openai-to-claude.ts";
import { cleanJSONSchemaForAntigravity, generateProjectId, generateRequestId, generateSessionId, tryParseJSON } from "../helpers/geminiHelper.ts";
import { openaiToGeminiCLIRequest } from "./openai-to-gemini.base.ts";

function generateUUID() {
  return crypto.randomUUID();
}

// Wrap Gemini CLI format in Cloud Code wrapper
export function wrapInCloudCodeEnvelope(model, geminiCLI, credentials = null, isAntigravity = false) {
  const projectId = credentials?.projectId || generateProjectId();

  const cleanModel = model.includes("/") ? model.split("/").pop()! : model;

  const envelope: Record<string, any> = {
    project: projectId,
    model: cleanModel,
    userAgent: isAntigravity ? "antigravity" : "gemini-cli",
    requestId: isAntigravity ? `agent-${generateUUID()}` : generateRequestId(),
    request: {
      sessionId: generateSessionId(),
      contents: geminiCLI.contents,
      systemInstruction: geminiCLI.systemInstruction,
      generationConfig: geminiCLI.generationConfig,
      tools: geminiCLI.tools,
    },
  };

  // Antigravity specific fields
  if (isAntigravity) {
    envelope.requestType = "agent";

    // Inject required default system prompt for Antigravity
    const defaultPart: Record<string, any> = { text: ANTIGRAVITY_DEFAULT_SYSTEM };
    if (envelope.request.systemInstruction?.parts) {
      envelope.request.systemInstruction.parts.unshift(defaultPart);
    } else {
      envelope.request.systemInstruction = { role: "user", parts: [defaultPart] };
    }

    // Add toolConfig for Antigravity
    if (geminiCLI.tools?.length > 0) {
      envelope.request.toolConfig = {
        functionCallingConfig: { mode: "VALIDATED" },
      };
    }
  } else {
    // Keep safetySettings for Gemini CLI
    envelope.request.safetySettings = geminiCLI.safetySettings;
  }

  return envelope;
}

// Wrap Claude format in Cloud Code envelope for Antigravity
export function wrapInCloudCodeEnvelopeForClaude(model, claudeRequest, credentials = null) {
  const projectId = credentials?.projectId || generateProjectId();

  const cleanModel = model.includes("/") ? model.split("/").pop()! : model;

  const envelope: Record<string, any> = {
    project: projectId,
    model: cleanModel,
    userAgent: "antigravity",
    requestId: `agent-${generateUUID()}`,
    requestType: "agent",
    request: {
      sessionId: generateSessionId(),
      contents: [],
      generationConfig: {
        temperature: claudeRequest.temperature || 1,
        maxOutputTokens: claudeRequest.max_tokens || 4096,
      },
    },
  };

  // Convert Claude messages to Gemini contents
  if (claudeRequest.messages && Array.isArray(claudeRequest.messages)) {
    for (const msg of claudeRequest.messages) {
      const parts = [];

      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text") {
            parts.push({ text: block.text });
          } else if (block.type === "tool_use") {
            parts.push({
              functionCall: {
                id: block.id,
                name: block.name,
                args: block.input || {},
              },
            });
          } else if (block.type === "tool_result") {
            let content = block.content;
            if (Array.isArray(content)) {
              content = content
                .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
                .join("\n");
            }
            parts.push({
              functionResponse: {
                id: block.tool_use_id,
                name: "unknown",
                response: { result: tryParseJSON(content) || content },
              },
            });
          }
        }
      } else if (typeof msg.content === "string") {
        parts.push({ text: msg.content });
      }

      if (parts.length > 0) {
        envelope.request.contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts,
        });
      }
    }
  }

  // Convert Claude tools to Gemini functionDeclarations
  if (claudeRequest.tools && Array.isArray(claudeRequest.tools)) {
    const functionDeclarations = [];
    for (const tool of claudeRequest.tools) {
      if (tool.name && tool.input_schema) {
        const cleanedSchema = cleanJSONSchemaForAntigravity(tool.input_schema);
        functionDeclarations.push({
          name: tool.name,
          description: tool.description || "",
          parameters: cleanedSchema,
        });
      }
    }
    if (functionDeclarations.length > 0) {
      envelope.request.tools = [{ functionDeclarations }];
      envelope.request.toolConfig = {
        functionCallingConfig: { mode: "VALIDATED" },
      };
    }
  }

  // Add system instruction (Antigravity default)
  const defaultPart = { text: ANTIGRAVITY_DEFAULT_SYSTEM };
  const systemParts = [defaultPart];

  if (claudeRequest.system) {
    if (Array.isArray(claudeRequest.system)) {
      for (const block of claudeRequest.system) {
        if (block.text) systemParts.push({ text: block.text });
      }
    } else if (typeof claudeRequest.system === "string") {
      systemParts.push({ text: claudeRequest.system });
    }
  }

  envelope.request.systemInstruction = { role: "user", parts: systemParts };

  return envelope;
}

// OpenAI -> Antigravity (Sandbox Cloud Code with wrapper)
export function openaiToAntigravityRequest(model, body, stream, credentials = null) {
  const isClaude = model.toLowerCase().includes("claude");

  if (isClaude) {
    const claudeRequest = openaiToClaudeRequestForAntigravity(model, body, stream);
    return wrapInCloudCodeEnvelopeForClaude(model, claudeRequest, credentials);
  }

  const geminiCLI = openaiToGeminiCLIRequest(model, body, stream);
  return wrapInCloudCodeEnvelope(model, geminiCLI, credentials, true);
}
