"use client";

import { useState, useEffect } from "react";
import Button from "@/shared/components/Button";

interface ProviderApiKey {
  id: string;
  provider: string;
  connectionId?: string;
  apiKey: string;
  name: string;
  priority: number;
  isActive: boolean;
  lastUsedAt?: string;
  useCount: number;
  rateLimitedUntil?: string;
  lastError?: string;
  createdAt: string;
}

interface MultiKeyManagerProps {
  providerId: string;
  connectionId?: string;
}

export function MultiKeyManager({ providerId, connectionId }: MultiKeyManagerProps) {
  const [keys, setKeys] = useState<ProviderApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [roundRobinEnabled, setRoundRobinEnabled] = useState(false);

  useEffect(() => {
    loadKeys();
    loadRoundRobinSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  async function loadKeys() {
    try {
      const params = new URLSearchParams({ provider: providerId });
      if (connectionId) params.append("connectionId", connectionId);

      const res = await fetch(`/api/provider-api-keys?${params}`);
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error("Failed to load API keys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoundRobinSettings() {
    try {
      const res = await fetch(`/api/round-robin?provider=${providerId}`);
      const data = await res.json();
      setRoundRobinEnabled(data.settings?.enabled || false);
    } catch (error) {
      console.error("Failed to load round-robin settings:", error);
    }
  }

  async function addKey() {
    if (!newKeyValue.trim()) return;

    try {
      const res = await fetch("/api/provider-api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          connectionId,
          apiKey: newKeyValue,
          name: newKeyName || `Key ${keys.length + 1}`,
        }),
      });

      if (res.ok) {
        setNewKeyName("");
        setNewKeyValue("");
        setShowAddForm(false);
        await loadKeys();
      }
    } catch (error) {
      console.error("Failed to add API key:", error);
    }
  }

  async function deleteKey(id: string) {
    if (!confirm("Delete this API key?")) return;

    try {
      const res = await fetch(`/api/provider-api-keys/${id}`, { method: "DELETE" });
      if (res.ok) await loadKeys();
    } catch (error) {
      console.error("Failed to delete API key:", error);
    }
  }

  async function toggleKeyActive(id: string, isActive: boolean) {
    try {
      await fetch(`/api/provider-api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      await loadKeys();
    } catch (error) {
      console.error("Failed to update API key:", error);
    }
  }

  async function updatePriority(id: string, direction: "up" | "down") {
    const key = keys.find((k) => k.id === id);
    if (!key) return;

    const newPriority = direction === "up" ? key.priority - 1 : key.priority + 1;
    if (newPriority < 1) return;

    try {
      await fetch(`/api/provider-api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      await loadKeys();
    } catch (error) {
      console.error("Failed to update priority:", error);
    }
  }

  async function toggleRoundRobin(enabled: boolean) {
    try {
      await fetch("/api/round-robin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, enabled }),
      });
      setRoundRobinEnabled(enabled);
    } catch (error) {
      console.error("Failed to update round-robin settings:", error);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading API keys...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">API Keys</h3>
          <p className="text-sm text-gray-500">Manage multiple API keys for load balancing</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
          <span className="mr-2">+</span>
          Add Key
        </Button>
      </div>

      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          checked={roundRobinEnabled}
          onChange={(e) => toggleRoundRobin(e.target.checked)}
          className="h-4 w-4"
        />
        <label className="text-sm">Enable round-robin load balancing for this provider</label>
      </div>

      {showAddForm && (
        <div className="p-4 space-y-3 border rounded-lg">
          <div>
            <label htmlFor="keyName" className="block text-sm font-medium mb-1">
              Key Name (optional)
            </label>
            <input
              id="keyName"
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Production Key"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label htmlFor="keyValue" className="block text-sm font-medium mb-1">
              API Key
            </label>
            <input
              id="keyValue"
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex space-x-2">
            <Button onClick={addKey} size="sm">
              Add
            </Button>
            <Button onClick={() => setShowAddForm(false)} size="sm" className="border">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2 opacity-50">🔑</div>
          <p>No API keys configured</p>
          <p className="text-sm">Add multiple keys for automatic load balancing</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={key.isActive}
                      onChange={(e) => toggleKeyActive(key.id, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <div>
                      <div className="font-medium">{key.name}</div>
                      <div className="text-xs text-gray-500">
                        Priority: {key.priority} | Used: {key.useCount} times
                        {key.lastUsedAt && (
                          <> | Last used: {new Date(key.lastUsedAt).toLocaleString()}</>
                        )}
                      </div>
                      {key.rateLimitedUntil && new Date(key.rateLimitedUntil) > new Date() && (
                        <div className="text-xs text-red-600 mt-1">
                          Rate limited until {new Date(key.rateLimitedUntil).toLocaleString()}
                        </div>
                      )}
                      {key.lastError && (
                        <div className="text-xs text-red-600 mt-1">Error: {key.lastError}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => updatePriority(key.id, "up")}
                    size="sm"
                    disabled={key.priority === 1}
                    className="opacity-50 hover:opacity-100"
                  >
                    ↑
                  </Button>
                  <Button
                    onClick={() => updatePriority(key.id, "down")}
                    size="sm"
                    className="opacity-50 hover:opacity-100"
                  >
                    ↓
                  </Button>
                  <Button
                    onClick={() => deleteKey(key.id)}
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
