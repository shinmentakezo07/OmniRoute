 -- 002_multi_key_round_robin.sql
 -- Add support for multiple API keys per provider with round-robin load balancing
 
 -- New table for storing multiple API keys per provider
 CREATE TABLE IF NOT EXISTS provider_api_keys (
   id TEXT PRIMARY KEY,
   provider TEXT NOT NULL,
   connection_id TEXT,
   api_key TEXT NOT NULL,
   name TEXT,
   priority INTEGER DEFAULT 0,
   is_active INTEGER DEFAULT 1,
   last_used_at TEXT,
   use_count INTEGER DEFAULT 0,
   rate_limited_until TEXT,
   last_error TEXT,
   last_error_at TEXT,
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL,
   FOREIGN KEY (connection_id) REFERENCES provider_connections(id) ON DELETE CASCADE
 );
 
 CREATE INDEX IF NOT EXISTS idx_pak_provider ON provider_api_keys(provider);
 CREATE INDEX IF NOT EXISTS idx_pak_connection ON provider_api_keys(connection_id);
 CREATE INDEX IF NOT EXISTS idx_pak_active ON provider_api_keys(is_active);
 CREATE INDEX IF NOT EXISTS idx_pak_priority ON provider_api_keys(provider, priority, last_used_at);
 
 -- Settings table for round-robin configuration
 CREATE TABLE IF NOT EXISTS round_robin_settings (
   provider TEXT PRIMARY KEY,
   enabled INTEGER DEFAULT 0,
   strategy TEXT DEFAULT 'round_robin',
   updated_at TEXT NOT NULL
 );
 
 -- Global round-robin setting
 INSERT OR IGNORE INTO key_value (namespace, key, value) 
 VALUES ('settings', 'global_round_robin_enabled', '0');
 
 -- Migrate existing api_key from provider_connections to provider_api_keys
 INSERT INTO provider_api_keys (id, provider, connection_id, api_key, name, priority, is_active, use_count, created_at, updated_at)
 SELECT 
   lower(hex(randomblob(16))),
   provider,
   id,
   api_key,
   name || ' (Primary)',
   1,
   is_active,
   0,
   created_at,
   updated_at
 FROM provider_connections
 WHERE api_key IS NOT NULL AND api_key != '';
