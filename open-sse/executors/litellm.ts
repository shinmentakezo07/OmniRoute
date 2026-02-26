import { BaseExecutor } from './base.ts';
import { HTTP_STATUS } from '../config/constants.ts';

/**
 * LiteLLM Executor - Routes requests through LiteLLM proxy
 * Supports 100+ providers via unified OpenAI-compatible interface
 */
export class LiteLLMExecutor extends BaseExecutor {
  constructor() {
    const proxyUrl = process.env.LITELLM_PROXY_URL || 'http://localhost:4000';
    
    super('litellm', {
      baseUrl: `${proxyUrl}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  buildUrl(model: string, stream: boolean, urlIndex = 0, credentials: any = null) {
    // LiteLLM uses standard OpenAI endpoint
    return this.config.baseUrl;
  }

  buildHeaders(credentials: any, stream = true) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Use master key or virtual key
    const apiKey = credentials.apiKey || 
                   credentials.accessToken || 
                   process.env.LITELLM_MASTER_KEY;
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (stream) {
      headers['Accept'] = 'text/event-stream';
    }

    return headers;
  }

  transformRequest(model: string, body: any, stream: boolean, credentials: any) {
    // LiteLLM accepts OpenAI format directly
    // Model name should be from litellm-config.yaml (e.g., "bedrock-claude-3-5-sonnet")
    return {
      ...body,
      model,
      stream,
    };
  }

  async refreshCredentials(credentials: any, log: any) {
    // LiteLLM handles token refresh internally for OAuth providers
    // We don't need to implement refresh logic here
    return null;
  }

  parseError(response: any, bodyText: string) {
    try {
      const error = JSON.parse(bodyText);
      return {
        status: response.status,
        message: error?.error?.message || bodyText || `HTTP ${response.status}`,
      };
    } catch {
      return {
        status: response.status,
        message: bodyText || `HTTP ${response.status}`,
      };
    }
  }
}

export default LiteLLMExecutor;
