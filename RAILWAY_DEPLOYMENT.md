# Railway Deployment Guide - LiteLLM Integration

## Overview

This guide covers deploying OmniRoute with LiteLLM on Railway. Railway supports multiple deployment strategies for this setup.

## Deployment Options

### Option 1: OmniRoute Only (Recommended for Start)

Deploy OmniRoute on Railway and use an external LiteLLM instance (self-hosted or managed).

**Steps:**

1. **Deploy OmniRoute to Railway**
   ```bash
   # Push to GitHub
   git add .
   git commit -m "Add LiteLLM integration"
   git push
   
   # In Railway dashboard:
   # - New Project → Deploy from GitHub
   # - Select your repository
   # - Railway will auto-detect Next.js
   ```

2. **Set Environment Variables in Railway**
   ```
   # OmniRoute variables (existing)
   DATA_DIR=/app/data
   PORT=8080
   
   # LiteLLM variables (if using external LiteLLM)
   LITELLM_ENABLED=true
   LITELLM_PROXY_URL=https://your-litellm-instance.com
   LITELLM_MASTER_KEY=sk-your-master-key
   ```

3. **Deploy LiteLLM Separately**
   - Use Docker on your own server
   - Use a managed LiteLLM service
   - Deploy to another Railway service (see Option 2)

---

### Option 2: OmniRoute + LiteLLM on Railway (Advanced)

Deploy both OmniRoute and LiteLLM as separate Railway services.

**Architecture:**
```
Railway Project
├── omniroute (Next.js service)
├── litellm-proxy (Docker service)
├── postgres (Railway PostgreSQL)
└── redis (Railway Redis)
```

**Steps:**

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli
   
   # Login
   railway login
   
   # Create project
   railway init
   ```

2. **Deploy PostgreSQL**
   - In Railway dashboard: New → Database → PostgreSQL
   - Note the connection URL

3. **Deploy Redis**
   - In Railway dashboard: New → Database → Redis
   - Note the connection URL

4. **Deploy LiteLLM Service**
   ```bash
   # Create new service from Dockerfile
   railway up -d
   
   # Or use Railway dashboard:
   # - New → Empty Service
   # - Settings → Source → Connect to GitHub
   # - Build → Dockerfile Path: Dockerfile.litellm
   ```

   **Environment Variables for LiteLLM:**
   ```
   LITELLM_MASTER_KEY=sk-litellm-<generate-random>
   LITELLM_SALT_KEY=<generate-random-32-chars>
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_HOST=${{Redis.REDIS_HOST}}
   REDIS_PORT=${{Redis.REDIS_PORT}}
   REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
   LITELLM_MODE=PRODUCTION
   LITELLM_LOG=ERROR
   PORT=4000
   
   # Provider API keys
   AWS_ACCESS_KEY_ID=<your-key>
   AWS_SECRET_ACCESS_KEY=<your-secret>
   VERTEX_PROJECT_ID=<your-project>
   TOGETHER_API_KEY=<your-key>
   ```

5. **Deploy OmniRoute Service**
   ```bash
   # Deploy from GitHub
   railway up
   ```

   **Environment Variables for OmniRoute:**
   ```
   DATA_DIR=/app/data
   PORT=8080
   LITELLM_ENABLED=true
   LITELLM_PROXY_URL=${{litellm-proxy.RAILWAY_PUBLIC_DOMAIN}}
   LITELLM_MASTER_KEY=${{litellm-proxy.LITELLM_MASTER_KEY}}
   ```

6. **Configure Networking**
   - LiteLLM service: Enable public domain
   - OmniRoute service: Enable public domain
   - Services can communicate via Railway's private network

---

### Option 3: External LiteLLM (Simplest)

Use a managed LiteLLM service or deploy LiteLLM elsewhere.

**Steps:**

1. **Deploy LiteLLM Externally**
   - Use your own server with Docker
   - Use a cloud provider (AWS, GCP, Azure)
   - Use a managed service

2. **Deploy OmniRoute to Railway**
   ```bash
   railway up
   ```

3. **Set Environment Variables**
   ```
   LITELLM_ENABLED=true
   LITELLM_PROXY_URL=https://your-litellm-url.com
   LITELLM_MASTER_KEY=sk-your-master-key
   ```

---

## Railway Configuration Files

### railway.json (OmniRoute)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/settings",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### railway.litellm.json (LiteLLM Service)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "name": "litellm-proxy",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.litellm"
  },
  "deploy": {
    "startCommand": "litellm --port $PORT --config /app/config.yaml",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Environment Variables Reference

### OmniRoute (Required)
```bash
# Core
DATA_DIR=/app/data
PORT=8080

# LiteLLM Integration
LITELLM_ENABLED=true
LITELLM_PROXY_URL=https://your-litellm-url
LITELLM_MASTER_KEY=sk-your-master-key
```

### LiteLLM Service (Required)
```bash
# Core
LITELLM_MASTER_KEY=sk-litellm-<random>
LITELLM_SALT_KEY=<random-32-chars>
DATABASE_URL=postgresql://...
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=<password>
LITELLM_MODE=PRODUCTION
LITELLM_LOG=ERROR
PORT=4000

# Provider Keys (as needed)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
VERTEX_PROJECT_ID=
TOGETHER_API_KEY=
OPENAI_API_KEY=
```

---

## Cost Considerations

### Railway Pricing (as of 2026)

**Hobby Plan ($5/month):**
- $5 credit included
- Good for testing
- Limited resources

**Pro Plan ($20/month):**
- $20 credit included
- Better for production
- More resources

**Service Costs:**
- OmniRoute: ~$5-10/month (depending on traffic)
- LiteLLM: ~$5-10/month
- PostgreSQL: ~$5/month
- Redis: ~$5/month

**Total Estimate:** $20-35/month for full stack on Railway

**Cost Optimization:**
- Use external LiteLLM (Option 3) to save ~$15/month
- Use Railway only for OmniRoute
- Deploy LiteLLM on cheaper infrastructure

---

## Troubleshooting

### LiteLLM Service Won't Start

**Check logs:**
```bash
railway logs -s litellm-proxy
```

**Common issues:**
- Missing environment variables
- Invalid DATABASE_URL
- Redis connection failed
- Config file not found

**Solutions:**
- Verify all env vars are set
- Check database and Redis are running
- Ensure `litellm-config.yaml` is in repository

### OmniRoute Can't Connect to LiteLLM

**Check:**
1. LiteLLM service is running
2. `LITELLM_PROXY_URL` is correct
3. `LITELLM_MASTER_KEY` matches
4. LiteLLM has public domain enabled

**Test connection:**
```bash
curl https://your-litellm-url.railway.app/health
```

### Database Connection Issues

**Railway PostgreSQL:**
- Use `${{Postgres.DATABASE_URL}}` reference
- Don't hardcode connection strings
- Check database is in same project

### High Costs

**Optimize:**
- Use smaller Railway plans
- Deploy LiteLLM externally
- Use Redis only if needed (LiteLLM can work without it)
- Monitor usage in Railway dashboard

---

## Recommended Setup for Production

**Best Practice:**

1. **OmniRoute on Railway** ($10-15/month)
   - Easy deployment
   - Auto-scaling
   - Good performance

2. **LiteLLM on Separate Infrastructure** ($5-10/month)
   - Use Docker on DigitalOcean/Hetzner
   - Or use managed PostgreSQL + Redis
   - Lower cost, more control

3. **Total Cost:** $15-25/month

This gives you the best balance of convenience and cost.

---

## Next Steps

1. Choose your deployment option (1, 2, or 3)
2. Set up Railway project
3. Configure environment variables
4. Deploy services
5. Test LiteLLM integration
6. Monitor costs and performance

For detailed Railway documentation: https://docs.railway.app

---

**Last Updated:** 2026-02-26  
**Status:** ✅ Ready for Railway Deployment
