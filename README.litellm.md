# LiteLLM Integration

OmniRoute now supports LiteLLM as an optional backend, giving you access to 100+ LLM providers through a single unified interface.

## Quick Start

```bash
# 1. Generate secure keys
export LITELLM_MASTER_KEY="sk-litellm-$(openssl rand -hex 16)"

# 2. Create network
docker network create omniroute-network 2>/dev/null || true

# 3. Start LiteLLM
docker compose -f docker-compose.litellm.yml up -d

# 4. Verify
curl http://localhost:4000/health
```

## What You Get

- ✅ **100+ Providers**: AWS Bedrock, Vertex AI, Together AI, Replicate, and more
- ✅ **Keep All Features**: Combos, analytics, semantic cache, rate limiting
- ✅ **Flexible Routing**: Mix native and LiteLLM providers
- ✅ **Minimal Overhead**: ~12ms latency per request

## Documentation

See [docs/litellm-integration.md](docs/litellm-integration.md) for complete setup guide.

## Architecture

```
Client → OmniRoute → LiteLLM Proxy → 100+ Providers
         ↓
    Native Providers (OpenAI, Anthropic, etc.)
```

LiteLLM runs as a separate service alongside OmniRoute, not as a replacement.
