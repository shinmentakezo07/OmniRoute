"use client";

import { useState, useEffect } from "react";

export function GlobalRoundRobinSettings() {
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/round-robin");
      const data = await res.json();
      setGlobalEnabled(data.globalEnabled || false);
    } catch (error) {
      console.error("Failed to load round-robin settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleGlobal(enabled: boolean) {
    try {
      await fetch("/api/round-robin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalEnabled: enabled }),
      });
      setGlobalEnabled(enabled);
    } catch (error) {
      console.error("Failed to update global round-robin:", error);
    }
  }

  if (loading) return null;

  return (
    <div className="p-6 border rounded-lg bg-white">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Round-Robin Load Balancing</h3>
          <p className="text-sm text-gray-500 mt-1">
            Automatically distribute requests across multiple API keys for each provider
          </p>
        </div>

        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            checked={globalEnabled}
            onChange={(e) => toggleGlobal(e.target.checked)}
            className="h-4 w-4"
          />
          <div>
            <label className="text-sm font-medium">
              Enable global round-robin for all providers
            </label>
            <p className="text-xs text-gray-500 mt-1">
              When enabled, all providers with multiple API keys will use round-robin load
              balancing. You can override this per-provider in provider settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
