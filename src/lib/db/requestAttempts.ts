/**
 * Request Attempts Tracking — Phase 10
 *
 * Tracks every candidate/retry attempt in the request pipeline:
 * - Combo fallback chains
 * - Retry attempts
 * - Model selection reasons
 * - Circuit breaker states
 * - Account health scores
 */

import { v4 as uuidv4 } from "uuid";
import { getDbInstance, isCloud, isBuildPhase } from "./core";

const shouldPersistToDisk = !isCloud && !isBuildPhase;

interface RequestAttempt {
  id: string;
  requestId: string;
  timestamp: string;
  attemptNumber: number;
  attemptType: "primary" | "fallback" | "retry";
  model: string;
  provider: string | null;
  connectionId: string | null;
  account: string | null;
  selectionReason: string | null;
  healthScore: number | null;
  circuitBreakerState: string | null;
  status: number | null;
  error: string | null;
  latencyMs: number;
  skipped: boolean;
  skipReason: string | null;
  comboName: string | null;
  apiKeyId: string | null;
}

/**
 * Track a request attempt (candidate or retry)
 */
export function trackRequestAttempt(entry: Partial<RequestAttempt>) {
  if (!shouldPersistToDisk) return;

  try {
    const attempt: RequestAttempt = {
      id: entry.id || uuidv4(),
      requestId: entry.requestId || uuidv4(),
      timestamp: entry.timestamp || new Date().toISOString(),
      attemptNumber: entry.attemptNumber || 1,
      attemptType: entry.attemptType || "primary",
      model: entry.model || "unknown",
      provider: entry.provider || null,
      connectionId: entry.connectionId || null,
      account: entry.account || null,
      selectionReason: entry.selectionReason || null,
      healthScore: entry.healthScore ?? null,
      circuitBreakerState: entry.circuitBreakerState || null,
      status: entry.status ?? null,
      error: entry.error || null,
      latencyMs: entry.latencyMs || 0,
      skipped: entry.skipped || false,
      skipReason: entry.skipReason || null,
      comboName: entry.comboName || null,
      apiKeyId: entry.apiKeyId || null,
    };

    const db = getDbInstance();
    db.prepare(
      `INSERT INTO request_attempts (
        id, request_id, timestamp, attempt_number, attempt_type,
        model, provider, connection_id, account, selection_reason,
        health_score, circuit_breaker_state, status, error, latency_ms,
        skipped, skip_reason, combo_name, api_key_id
      ) VALUES (
        @id, @requestId, @timestamp, @attemptNumber, @attemptType,
        @model, @provider, @connectionId, @account, @selectionReason,
        @healthScore, @circuitBreakerState, @status, @error, @latencyMs,
        @skipped, @skipReason, @comboName, @apiKeyId
      )`
    ).run({
      id: attempt.id,
      requestId: attempt.requestId,
      timestamp: attempt.timestamp,
      attemptNumber: attempt.attemptNumber,
      attemptType: attempt.attemptType,
      model: attempt.model,
      provider: attempt.provider,
      connectionId: attempt.connectionId,
      account: attempt.account,
      selectionReason: attempt.selectionReason,
      healthScore: attempt.healthScore,
      circuitBreakerState: attempt.circuitBreakerState,
      status: attempt.status,
      error: attempt.error,
      latencyMs: attempt.latencyMs,
      skipped: attempt.skipped ? 1 : 0,
      skipReason: attempt.skipReason,
      comboName: attempt.comboName,
      apiKeyId: attempt.apiKeyId,
    });

    return attempt;
  } catch (err: any) {
    console.warn("[requestAttempts] Failed to track attempt:", err.message);
    return null;
  }
}

/**
 * Get all attempts for a specific request
 */
export function getRequestAttempts(requestId: string) {
  if (!shouldPersistToDisk) return [];

  try {
    const db = getDbInstance();
    const rows = db
      .prepare("SELECT * FROM request_attempts WHERE request_id = ? ORDER BY attempt_number ASC")
      .all(requestId) as any[];

    return rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      timestamp: row.timestamp,
      attemptNumber: row.attempt_number,
      attemptType: row.attempt_type,
      model: row.model,
      provider: row.provider,
      connectionId: row.connection_id,
      account: row.account,
      selectionReason: row.selection_reason,
      healthScore: row.health_score,
      circuitBreakerState: row.circuit_breaker_state,
      status: row.status,
      error: row.error,
      latencyMs: row.latency_ms,
      skipped: row.skipped === 1,
      skipReason: row.skip_reason,
      comboName: row.combo_name,
      apiKeyId: row.api_key_id,
    }));
  } catch (err: any) {
    console.warn("[requestAttempts] Failed to get attempts:", err.message);
    return [];
  }
}

/**
 * Query attempts with filters
 */
export function queryRequestAttempts(filters: {
  model?: string;
  provider?: string;
  status?: number;
  skipped?: boolean;
  comboName?: string;
  limit?: number;
}) {
  if (!shouldPersistToDisk) return [];

  try {
    const db = getDbInstance();
    let sql = "SELECT * FROM request_attempts WHERE 1=1";
    const params: any = {};

    if (filters.model) {
      sql += " AND model = @model";
      params.model = filters.model;
    }
    if (filters.provider) {
      sql += " AND provider = @provider";
      params.provider = filters.provider;
    }
    if (filters.status !== undefined) {
      sql += " AND status = @status";
      params.status = filters.status;
    }
    if (filters.skipped !== undefined) {
      sql += " AND skipped = @skipped";
      params.skipped = filters.skipped ? 1 : 0;
    }
    if (filters.comboName) {
      sql += " AND combo_name = @comboName";
      params.comboName = filters.comboName;
    }

    sql += " ORDER BY timestamp DESC LIMIT ?";
    const limit = filters.limit || 500;

    const rows = db.prepare(sql).all({ ...params, limit }) as any[];

    return rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      timestamp: row.timestamp,
      attemptNumber: row.attempt_number,
      attemptType: row.attempt_type,
      model: row.model,
      provider: row.provider,
      connectionId: row.connection_id,
      account: row.account,
      selectionReason: row.selection_reason,
      healthScore: row.health_score,
      circuitBreakerState: row.circuit_breaker_state,
      status: row.status,
      error: row.error,
      latencyMs: row.latency_ms,
      skipped: row.skipped === 1,
      skipReason: row.skip_reason,
      comboName: row.combo_name,
      apiKeyId: row.api_key_id,
    }));
  } catch (err: any) {
    console.warn("[requestAttempts] Failed to query attempts:", err.message);
    return [];
  }
}

/**
 * Get attempt statistics
 */
export function getAttemptStats(filters: { model?: string; comboName?: string } = {}) {
  if (!shouldPersistToDisk) return null;

  try {
    const db = getDbInstance();
    let sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN status >= 200 AND status < 300 THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error,
        AVG(latency_ms) as avg_latency,
        AVG(attempt_number) as avg_attempts
      FROM request_attempts
      WHERE 1=1
    `;
    const params: any = {};

    if (filters.model) {
      sql += " AND model = @model";
      params.model = filters.model;
    }
    if (filters.comboName) {
      sql += " AND combo_name = @comboName";
      params.comboName = filters.comboName;
    }

    const row = db.prepare(sql).get(params) as any;

    return {
      total: row.total || 0,
      skipped: row.skipped || 0,
      success: row.success || 0,
      error: row.error || 0,
      avgLatency: Math.round(row.avg_latency || 0),
      avgAttempts: parseFloat((row.avg_attempts || 0).toFixed(2)),
    };
  } catch (err: any) {
    console.warn("[requestAttempts] Failed to get stats:", err.message);
    return null;
  }
}

/**
 * Clear old attempts (retention policy)
 */
export function clearOldAttempts(daysToKeep: number = 7) {
  if (!shouldPersistToDisk) return 0;

  try {
    const db = getDbInstance();
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare("DELETE FROM request_attempts WHERE timestamp < ?").run(cutoff);
    return result.changes || 0;
  } catch (err: any) {
    console.warn("[requestAttempts] Failed to clear old attempts:", err.message);
    return 0;
  }
}
