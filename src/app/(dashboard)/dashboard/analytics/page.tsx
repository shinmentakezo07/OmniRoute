"use client";

import { useState, Suspense } from "react";
import { UsageAnalytics, CardSkeleton, SegmentedControl } from "@/shared/components";
import EvalsTab from "../usage/components/EvalsTab";
import { useTranslations } from "next-intl";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const t = useTranslations("analytics");

  const tabMeta = {
    overview: {
      description: t("overviewDescription"),
      highlights: ["Charts", "Usage trends", "Cost visibility"],
    },
    evals: {
      description: t("evalsDescription"),
      highlights: ["Quality checks", "Regression detection", "Latency benchmarks"],
    },
  };

  const activeMeta = tabMeta[activeTab as keyof typeof tabMeta];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-gradient-to-br from-primary/10 via-sky-500/5 to-emerald-500/10 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-text-main">
              <span className="material-symbols-outlined text-primary text-[28px]">analytics</span>
              {t("title")}
            </h1>
            <p className="text-sm text-text-muted mt-1 max-w-3xl">{activeMeta.description}</p>
          </div>

          <div className="rounded-xl bg-black/[0.03] dark:bg-black/20 border border-black/5 dark:border-white/10 p-1 w-full md:w-auto">
            <SegmentedControl
              options={[
                { value: "overview", label: t("overview"), icon: "insights" },
                { value: "evals", label: t("evals"), icon: "science" },
              ]}
              value={activeTab}
              onChange={setActiveTab}
              className="w-full"
              aria-label="Analytics tabs"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {activeMeta.highlights.map((item) => (
            <span
              key={item}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 text-text-muted"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <Suspense fallback={<CardSkeleton />}>
          <UsageAnalytics />
        </Suspense>
      )}
      {activeTab === "evals" && <EvalsTab />}
    </div>
  );
}
