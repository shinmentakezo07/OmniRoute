 # Multi-Key Round-Robin Load Balancing
 
 ## Overview
 
 This feature allows you to configure multiple API keys per provider with automatic round-robin load balancing. This enables:
 
 - **Higher throughput**: Distribute requests across multiple API keys to avoid rate limits
 - **Better reliability**: Automatic failover when one key hits rate limits
 - **Flexible configuration**: Enable round-robin globally or per-provider
 
 ## Architecture
 
 ### Database Schema
 
 **New Tables:**
 
 1. `provider_api_keys` - Stores multiple API keys per provider
    - `id`, `provider`, `connection_id`, `api_key`, `name`, `priority`
    - `is_active`, `last_used_at`, `use_count`, `rate_limited_until`
    - Tracks usage and rate limit status per key
 
 2. `round_robin_settings` - Per-provider round-robin configuration
    - `provider`, `enabled`, `strategy`, `updated_at`
 
 3. Global setting in `key_value` table:
    - `namespace='settings'`, `key='global_round_robin_enabled'`
 
 ### Key Components
 
 **Backend:**
 - `src/lib/db/providerApiKeys.ts` - Database operations for multi-key management
 - `src/lib/db/migrations/002_multi_key_round_robin.sql` - Schema migration
 - `src/sse/services/auth.ts` - Updated to use round-robin key selection
 - `src/app/api/provider-api-keys/` - REST API for key management
 - `src/app/api/round-robin/` - REST API for round-robin settings
 
 **Frontend:**
 - `src/app/(dashboard)/dashboard/providers/[id]/components/MultiKeyManager.tsx` - UI for managing keys
 - `src/app/(dashboard)/dashboard/settings/components/GlobalRoundRobinSettings.tsx` - Global settings UI
 
 ## Usage
 
 ### Adding Multiple API Keys
 
 1. Navigate to a provider's detail page
 2. Use the "Multi-Key Manager" component
 3. Click "Add Key" and enter:
    - Key name (optional)
    - API key value
 4. Keys are automatically assigned priority based on order
 
 ### Enabling Round-Robin
 
 **Global (all providers):**
 ```
 Settings → Round-Robin Load Balancing → Enable global round-robin
 ```
 
 **Per-provider:**
 ```
 Provider Detail Page → Enable round-robin for this provider
 ```
 
 ### API Usage
 
 **List keys for a provider:**
 ```bash
 GET /api/provider-api-keys?provider=openai
 ```
 
 **Add a new key:**
 ```bash
 POST /api/provider-api-keys
 {
   "provider": "openai",
   "apiKey": "sk-...",
   "name": "Production Key 1"
 }
 ```
 
 **Update key (toggle active, change priority):**
 ```bash
 PATCH /api/provider-api-keys/{id}
 {
   "isActive": false
 }
 ```
 
 **Delete a key:**
 ```bash
 DELETE /api/provider-api-keys/{id}
 ```
 
 **Configure round-robin:**
 ```bash
 POST /api/round-robin
 {
   "provider": "openai",
   "enabled": true,
   "strategy": "round_robin"
 }
 ```
 
 ## Selection Logic
 
 When round-robin is **enabled**:
 1. Filters out inactive keys and rate-limited keys
 2. Selects the least recently used key (`last_used_at ASC`)
 3. Updates `last_used_at` and increments `use_count`
 4. On rate limit error, marks key as unavailable with cooldown
 
 When round-robin is **disabled**:
 1. Uses highest priority key (lowest `priority` number)
 2. Falls back to legacy `provider_connections` behavior
 
 ## Rate Limit Handling
 
 When a key hits a rate limit:
 1. `markApiKeyRateLimited()` is called with cooldown duration
 2. Key is marked with `rate_limited_until` timestamp
 3. Key is automatically excluded from selection until cooldown expires
 4. Next available key is selected automatically
 
 ## Migration
 
 The migration (`002_multi_key_round_robin.sql`) automatically:
 - Creates new tables
 - Migrates existing `api_key` values from `provider_connections` to `provider_api_keys`
 - Preserves all existing functionality
 
 ## Configuration
 
 **Priority Management:**
 - Lower priority number = higher priority
 - Use UI arrows to reorder keys
 - Priority determines fallback order when round-robin is disabled
 
 **Active/Inactive:**
 - Inactive keys are never selected
 - Use to temporarily disable a key without deleting it
 
 ## Monitoring
 
 Each key tracks:
 - `use_count` - Total number of times used
 - `last_used_at` - Timestamp of last use
 - `rate_limited_until` - When rate limit expires
 - `last_error` - Last error message
 
 View this data in the Multi-Key Manager UI.
 
 ## Best Practices
 
 1. **Start with 2-3 keys per provider** to test load distribution
 2. **Monitor usage patterns** to optimize key count
 3. **Set meaningful names** for easy identification
 4. **Use priority** to prefer certain keys (e.g., higher quota keys first)
 5. **Enable per-provider** first before global to test behavior
 
 ## Troubleshooting
 
 **Keys not rotating:**
 - Check that round-robin is enabled (global or per-provider)
 - Verify keys are marked as active
 - Check for rate limit status
 
 **All keys rate limited:**
 - System will return 429 with retry-after header
 - Wait for cooldown to expire
 - Consider adding more keys or reducing request rate
 
 **Key not being used:**
 - Check `is_active` status
 - Verify `rate_limited_until` is null or expired
 - Check priority order
 
 ## Future Enhancements
 
 Possible improvements:
 - Weighted round-robin (based on quota/tier)
 - Smart selection based on response time
 - Per-model key assignment
 - Usage analytics and cost tracking per key
 - Automatic key health checks
