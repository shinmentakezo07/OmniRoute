/**
 * db/providerApiKeys.ts — Multiple API keys per provider with round-robin support.
 */

import { v4 as uuidv4 } from "uuid";
import { getDbInstance, rowToCamel, cleanNulls } from "./core";
import { backupDbFile } from "./backup";

// ──────────────── Provider API Keys ────────────────

export async function getProviderApiKeys(filter: any = {}) {
  const db = getDbInstance();
  let sql = "SELECT * FROM provider_api_keys";
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.provider) {
    conditions.push("provider = @provider");
    params.provider = filter.provider;
  }
  if (filter.connectionId) {
    conditions.push("connection_id = @connectionId");
    params.connectionId = filter.connectionId;
  }
  if (filter.isActive !== undefined) {
    conditions.push("is_active = @isActive");
    params.isActive = filter.isActive ? 1 : 0;
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY priority ASC, last_used_at ASC NULLS FIRST";

  const rows = db.prepare(sql).all(params);
  return rows.map((r) => cleanNulls(rowToCamel(r)));
}

export async function getProviderApiKeyById(id: string) {
  const db = getDbInstance();
  const row = db.prepare("SELECT * FROM provider_api_keys WHERE id = ?").get(id);
  return row ? cleanNulls(rowToCamel(row)) : null;
}

export async function createProviderApiKey(data: any) {
  const db = getDbInstance();
  const now = new Date().toISOString();

  // Auto-increment priority
  let keyPriority = data.priority;
  if (!keyPriority) {
    const max = db
      .prepare("SELECT MAX(priority) as maxP FROM provider_api_keys WHERE provider = ?")
      .get(data.provider);
    keyPriority = (max?.maxP || 0) + 1;
  }

  const apiKey = {
    id: uuidv4(),
    provider: data.provider,
    connectionId: data.connectionId || null,
    apiKey: data.apiKey,
    name: data.name || `Key ${keyPriority}`,
    priority: keyPriority,
    isActive: data.isActive !== undefined ? data.isActive : true,
    lastUsedAt: null,
    useCount: 0,
    rateLimitedUntil: null,
    lastError: null,
    lastErrorAt: null,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO provider_api_keys (
       id, provider, connection_id, api_key, name, priority, is_active,
       last_used_at, use_count, rate_limited_until, last_error, last_error_at,
       created_at, updated_at
     ) VALUES (
       @id, @provider, @connectionId, @apiKey, @name, @priority, @isActive,
       @lastUsedAt, @useCount, @rateLimitedUntil, @lastError, @lastErrorAt,
       @createdAt, @updatedAt
     )`
  ).run({
    id: apiKey.id,
    provider: apiKey.provider,
    connectionId: apiKey.connectionId,
    apiKey: apiKey.apiKey,
    name: apiKey.name,
    priority: apiKey.priority,
    isActive: apiKey.isActive ? 1 : 0,
    lastUsedAt: apiKey.lastUsedAt,
    useCount: apiKey.useCount,
    rateLimitedUntil: apiKey.rateLimitedUntil,
    lastError: apiKey.lastError,
    lastErrorAt: apiKey.lastErrorAt,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
  });

  backupDbFile("pre-write");
  return cleanNulls(apiKey);
}

export async function updateProviderApiKey(id: string, data: any) {
  const db = getDbInstance();
  const existing = db.prepare("SELECT * FROM provider_api_keys WHERE id = ?").get(id);
  if (!existing) return null;

  const merged = { ...rowToCamel(existing), ...data, updatedAt: new Date().toISOString() };

  db.prepare(
    `UPDATE provider_api_keys SET
       provider = @provider, connection_id = @connectionId, api_key = @apiKey,
       name = @name, priority = @priority, is_active = @isActive,
       last_used_at = @lastUsedAt, use_count = @useCount,
       rate_limited_until = @rateLimitedUntil, last_error = @lastError,
       last_error_at = @lastErrorAt, updated_at = @updatedAt
     WHERE id = @id`
  ).run({
    id,
    provider: merged.provider,
    connectionId: merged.connectionId || null,
    apiKey: merged.apiKey,
    name: merged.name,
    priority: merged.priority,
    isActive: merged.isActive ? 1 : 0,
    lastUsedAt: merged.lastUsedAt || null,
    useCount: merged.useCount || 0,
    rateLimitedUntil: merged.rateLimitedUntil || null,
    lastError: merged.lastError || null,
    lastErrorAt: merged.lastErrorAt || null,
    updatedAt: merged.updatedAt,
  });

  backupDbFile("pre-write");
  return cleanNulls(merged);
}

export async function deleteProviderApiKey(id: string) {
  const db = getDbInstance();
  const result = db.prepare("DELETE FROM provider_api_keys WHERE id = ?").run(id);
  if (result.changes === 0) return false;

  backupDbFile("pre-write");
  return true;
}

export async function markApiKeyUsed(id: string) {
  const db = getDbInstance();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE provider_api_keys 
      SET last_used_at = @now, use_count = use_count + 1, updated_at = @now
      WHERE id = @id`
  ).run({ id, now });
}

export async function markApiKeyRateLimited(id: string, until: string, error?: string) {
  const db = getDbInstance();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE provider_api_keys 
      SET rate_limited_until = @until, last_error = @error, last_error_at = @now, updated_at = @now
      WHERE id = @id`
  ).run({ id, until, error: error || null, now });
}

// ──────────────── Round-Robin Settings ────────────────

export async function getRoundRobinSettings(provider?: string) {
  const db = getDbInstance();

  if (provider) {
    const row = db.prepare("SELECT * FROM round_robin_settings WHERE provider = ?").get(provider);
    return row ? cleanNulls(rowToCamel(row)) : null;
  }

  const rows = db.prepare("SELECT * FROM round_robin_settings").all();
  return rows.map((r) => cleanNulls(rowToCamel(r)));
}

export async function setRoundRobinSettings(
  provider: string,
  enabled: boolean,
  strategy = "round_robin"
) {
  const db = getDbInstance();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO round_robin_settings (provider, enabled, strategy, updated_at)
      VALUES (@provider, @enabled, @strategy, @updatedAt)
      ON CONFLICT(provider) DO UPDATE SET
        enabled = @enabled,
        strategy = @strategy,
        updated_at = @updatedAt`
  ).run({
    provider,
    enabled: enabled ? 1 : 0,
    strategy,
    updatedAt: now,
  });

  backupDbFile("pre-write");
}

export async function getGlobalRoundRobinEnabled(): Promise<boolean> {
  const db = getDbInstance();
  const row = db
    .prepare(
      "SELECT value FROM key_value WHERE namespace = 'settings' AND key = 'global_round_robin_enabled'"
    )
    .get() as { value: string } | undefined;

  return row?.value === "1";
}

export async function setGlobalRoundRobinEnabled(enabled: boolean) {
  const db = getDbInstance();

  db.prepare(
    `INSERT INTO key_value (namespace, key, value)
      VALUES ('settings', 'global_round_robin_enabled', @value)
      ON CONFLICT(namespace, key) DO UPDATE SET value = @value`
  ).run({ value: enabled ? "1" : "0" });

  backupDbFile("pre-write");
}

// ──────────────── Round-Robin Selection Logic ────────────────

export async function selectApiKeyForProvider(provider: string): Promise<any | null> {
  const db = getDbInstance();
  const now = new Date().toISOString();

  // Check if round-robin is enabled (global or per-provider)
  const globalEnabled = await getGlobalRoundRobinEnabled();
  const providerSettings = await getRoundRobinSettings(provider);
  const roundRobinEnabled = globalEnabled || providerSettings?.enabled;

  if (!roundRobinEnabled) {
    // Return highest priority active key (legacy behavior)
    const row = db
      .prepare(
        `SELECT * FROM provider_api_keys 
          WHERE provider = @provider 
            AND is_active = 1 
            AND (rate_limited_until IS NULL OR rate_limited_until < @now)
          ORDER BY priority ASC
          LIMIT 1`
      )
      .get({ provider, now });

    return row ? cleanNulls(rowToCamel(row)) : null;
  }

  // Round-robin: select least recently used key
  const row = db
    .prepare(
      `SELECT * FROM provider_api_keys 
        WHERE provider = @provider 
          AND is_active = 1 
          AND (rate_limited_until IS NULL OR rate_limited_until < @now)
        ORDER BY last_used_at ASC NULLS FIRST, priority ASC
        LIMIT 1`
    )
    .get({ provider, now });

  return row ? cleanNulls(rowToCamel(row)) : null;
}
