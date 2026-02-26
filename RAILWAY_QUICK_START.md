# Railway Quick Start - LiteLLM Integration

## 🚀 Deploy to Railway in 5 Minutes

### Option 1: OmniRoute Only (Simplest)

**Step 1: Deploy OmniRoute**
```bash
# Push to GitHub
git add .
git commit -m "Add LiteLLM integration"
git push

# Deploy to Railway
# 1. Go to https://railway.app
# 2. Click "New Project"
# 3. Select "Deploy from GitHub repo"
# 4. Choose your repository
# 5. Railway auto-detects Next.js and deploys
```

**Step 2: Set Environment Variables**

In Railway dashboard → Variables:
```
DATA_DIR=/app/data
PORT=8080
LITELLM_ENABLED=false
```

**Step 3: Deploy LiteLLM Externally**

Use Docker on your own server:
```bash
docker network create omniroute-network
docker compose -f docker-compose.litellm.yml up -d
```

**Step 4: Connect OmniRoute to External LiteLLM**

Update Railway variables:
```
LITELLM_ENABLED=true
LITELLM_PROXY_URL=https://your-litellm-server.com:4000
LITELLM_MASTER_KEY=sk-your-master-key
```

✅ **Done!** OmniRoute is on Railway, LiteLLM is self-hosted.

---

### Option 2: Full Stack on Railway (Advanced)

**Step 1: Create Railway Project**
```bash
railway login
railway init
```

**Step 2: Add PostgreSQL**
- Railway Dashboard → New → Database → PostgreSQL
- Note: Railway auto-creates `DATABASE_URL`

**Step 3: Add Redis**
- Railway Dashboard → New → Database → Redis
- Note: Railway auto-creates Redis variables

**Step 4: Deploy LiteLLM Service**

Create `Dockerfile.litellm`:
```dockerfile
FROM ghcr.io/berriai/litellm:main-stable
COPY litellm-config.railway.yaml /app/config.yaml
EXPOSE 4000
CMD ["--port", "4000", "--config", "/app/config.yaml"]
```

Deploy:
- Railway Dashboard → New → Empty Service
- Settings → Source → Connect GitHub
- Settings → Build → Dockerfile Path: `Dockerfile.litellm`

Set variables:
```
LITELLM_MASTER_KEY=sk-litellm-<random>
LITELLM_SALT_KEY=<random-32-chars>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
LITELLM_MODE=PRODUCTION
PORT=4000
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

Enable public domain for LiteLLM service.

**Step 5: Deploy OmniRoute**

- Railway Dashboard → New → Deploy from GitHub
- Select your repository

Set variables:
```
DATA_DIR=/app/data
PORT=8080
LITELLM_ENABLED=true
LITELLM_PROXY_URL=${{litellm-proxy.RAILWAY_PUBLIC_DOMAIN}}
LITELLM_MASTER_KEY=${{litellm-proxy.LITELLM_MASTER_KEY}}
```

✅ **Done!** Full stack on Railway.

---

## 💰 Cost Estimate

### Option 1 (OmniRoute on Railway)
- Railway: $5-10/month
- Self-hosted LiteLLM: $5-10/month (your server)
- **Total: $10-20/month**

### Option 2 (Full Stack on Railway)
- OmniRoute: $5-10/month
- LiteLLM: $5-10/month
- PostgreSQL: $5/month
- Redis: $5/month
- **Total: $20-35/month**

**Recommendation:** Use Option 1 for cost savings.

---

## 🔧 Configuration

### Generate Secure Keys
```bash
# Master key
openssl rand -hex 16 | sed 's/^/sk-litellm-/'

# Salt key
openssl rand -hex 32
```

### Railway Variable References
```bash
# Reference other services
${{ServiceName.VARIABLE_NAME}}

# Examples
${{Postgres.DATABASE_URL}}
${{Redis.REDIS_HOST}}
${{litellm-proxy.LITELLM_MASTER_KEY}}
```

---

## ✅ Verification

### Test OmniRoute
```bash
curl https://your-omniroute.railway.app/api/settings
```

### Test LiteLLM
```bash
curl https://your-litellm.railway.app/health
```

### Test Integration
```bash
curl https://your-omniroute.railway.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "litellm/bedrock-claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check logs
railway logs

# Check specific service
railway logs -s litellm-proxy
```

### Can't Connect to LiteLLM
1. Verify LiteLLM service is running
2. Check `LITELLM_PROXY_URL` is correct
3. Ensure public domain is enabled
4. Test health endpoint

### Database Issues
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` reference is correct
3. Ensure services are in same project

---

## 📚 Next Steps

1. ✅ Deploy to Railway
2. ✅ Configure environment variables
3. ✅ Test integration
4. 📖 Read full guide: `RAILWAY_DEPLOYMENT.md`
5. 🎯 Add your provider API keys
6. 🚀 Start using 100+ providers!

---

**Last Updated:** 2026-02-26  
**Status:** ✅ Ready for Railway Deployment
