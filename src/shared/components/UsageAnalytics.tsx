"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Card from "./Card";
import { CardSkeleton } from "./Loading";
import { fmtCompact as fmt, fmtFull, fmtCost } from "@/shared/utils/formatting";
import {
  StatCard,
  ActivityHeatmap,
  DailyTrendChart,
  AccountDonut,
  ApiKeyDonut,
  ApiKeyTable,
  MostActiveDay7d,
  WeeklySquares7d,
  ModelTable,
  ProviderCostDonut,
  ModelOverTimeChart,
  ProviderTable,
} from "./analytics";

// ============================================================================
// Main Component
// ============================================================================

export default function UsageAnalytics() {
  const [range, setRange] = useState("30d");
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/usage/analytics?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAnalytics(data);
      setError(null);
    } catch (err) {
      setError((err as any).message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const ranges = [
    { value: "1d", label: "1D" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "ytd", label: "YTD" },
    { value: "all", label: "All" },
  ];

  const topModel = useMemo(() => {
    const models = analytics?.byModel || [];
    return models.length > 0 ? models[0].model : "—";
  }, [analytics]);

  const topProvider = useMemo(() => {
    const providers = analytics?.byProvider || [];
    return providers.length > 0 ? providers[0].provider : "—";
  }, [analytics]);

  const busiestDay = useMemo(() => {
    const wp = analytics?.weeklyPattern || [];
    if (!wp.length) return "—";
    const max = wp.reduce((a, b) => (a.avgTokens > b.avgTokens ? a : b), wp[0]);
    return max.avgTokens > 0 ? max.day : "—";
  }, [analytics]);

  const providerCount = useMemo(() => {
    return (analytics?.byProvider || []).length;
  }, [analytics]);

  if (loading && !analytics) return <CardSkeleton />;
  if (error) return <Card className="p-6 text-center text-red-500">Error: {error}</Card>;

  const s = analytics?.summary || {};

  // ── Derived insight values ──
  const avgTokensPerReq = s.totalRequests > 0 ? Math.round(s.totalTokens / s.totalRequests) : 0;
  const costPerReq = s.totalRequests > 0 ? s.totalCost / s.totalRequests : 0;
  const ioRatio = s.completionTokens > 0 ? (s.promptTokens / s.completionTokens).toFixed(1) : "—";

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Time Range */}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">analytics</span>
              Usage Analytics
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Unified view of token flow, trends, provider spend, and model distribution.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg p-1 border border-black/5 dark:border-white/5 w-full md:w-auto overflow-x-auto">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                  range === r.value
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
            Focus
          </p>
          <p className="text-sm font-medium text-text-main mt-1">Charts and trend exploration</p>
          <p className="text-xs text-text-muted mt-1">Inspect usage behavior and demand peaks.</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
            Evaluation
          </p>
          <p className="text-sm font-medium text-text-main mt-1">Quality and performance signals</p>
          <p className="text-xs text-text-muted mt-1">
            Use Evals tab to validate output quality regularly.
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">Cost</p>
          <p className="text-sm font-medium text-text-main mt-1">Provider and model spending</p>
          <p className="text-xs text-text-muted mt-1">
            Quickly identify high-cost models and providers.
          </p>
        </Card>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/10 p-3.5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[22px]">analytics</span>
          Insights snapshot
        </span>
        <span>•</span>
        <span>{fmtFull(s.totalRequests)} requests tracked</span>
        <span>•</span>
        <span>{fmt(s.totalTokens)} total tokens</span>
        <span>•</span>
        <span>{fmtCost(s.totalCost)} estimated cost</span>
      </div>

      {/* Summary Cards — Row 1: Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <StatCard
          icon="generating_tokens"
          label="Total Tokens"
          value={fmt(s.totalTokens)}
          subValue={`${fmtFull(s.totalRequests)} requests`}
        />
        <StatCard
          icon="input"
          label="Input Tokens"
          value={fmt(s.promptTokens)}
          color="text-primary"
        />
        <StatCard
          icon="output"
          label="Output Tokens"
          value={fmt(s.completionTokens)}
          color="text-emerald-500"
        />
        <StatCard
          icon="payments"
          label="Est. Cost"
          value={fmtCost(s.totalCost)}
          color="text-amber-500"
        />
        <StatCard icon="group" label="Accounts" value={s.uniqueAccounts || 0} />
        <StatCard icon="vpn_key" label="API Keys" value={s.uniqueApiKeys || 0} />
        <StatCard icon="model_training" label="Models" value={s.uniqueModels || 0} />
      </div>

      {/* Summary Cards — Row 2: Derived insights */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <StatCard
          icon="speed"
          label="Avg Tokens/Req"
          value={fmt(avgTokensPerReq)}
          color="text-cyan-500"
        />
        <StatCard
          icon="request_quote"
          label="Cost/Request"
          value={fmtCost(costPerReq)}
          color="text-orange-500"
        />
        <StatCard
          icon="compare_arrows"
          label="I/O Ratio"
          value={`${ioRatio}x`}
          color="text-violet-500"
        />
        <StatCard icon="star" label="Top Model" value={topModel} color="text-pink-500" />
        <StatCard icon="cloud" label="Top Provider" value={topProvider} color="text-teal-500" />
        <StatCard icon="today" label="Busiest Day" value={busiestDay} color="text-rose-500" />
        <StatCard icon="dns" label="Providers" value={providerCount} color="text-indigo-500" />
      </div>

      {/* Activity Heatmap + Weekly Widgets */}
      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "stretch" }}
      >
        <ActivityHeatmap activityMap={analytics?.activityMap} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MostActiveDay7d activityMap={analytics?.activityMap} />
          <WeeklySquares7d activityMap={analytics?.activityMap} />
        </div>
      </div>

      {/* Token & Cost Trend + Provider Cost Donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DailyTrendChart dailyTrend={analytics?.dailyTrend} />
        <ProviderCostDonut byProvider={analytics?.byProvider} />
      </div>

      {/* Model Usage Over Time (stacked area) */}
      <ModelOverTimeChart
        dailyByModel={analytics?.dailyByModel}
        modelNames={analytics?.modelNames}
      />

      {/* Account Donut + API Key Donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AccountDonut byAccount={analytics?.byAccount} />
        <ApiKeyDonut byApiKey={analytics?.byApiKey} />
      </div>

      {/* Provider Breakdown Table */}
      <ProviderTable byProvider={analytics?.byProvider} />

      {/* API Key Table */}
      <ApiKeyTable byApiKey={analytics?.byApiKey} />

      {/* Model Breakdown Table */}
      <ModelTable byModel={analytics?.byModel} summary={s} />
    </div>
  );
}
