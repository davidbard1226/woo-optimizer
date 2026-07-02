"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, CheckCircle, XCircle, Key, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    wc_url: "",
    wc_consumer_key: "",
    wc_consumer_secret: "",
    openrouter_api_key: "",
    ai_model: "deepseek/deepseek-chat-v3-0324:free",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wcTest, setWcTest] = useState<{ status: "idle" | "testing" | "success" | "error"; message: string }>({
    status: "idle",
    message: "",
  });
  const [aiTest, setAiTest] = useState<{ status: "idle" | "testing" | "success" | "error"; message: string }>({
    status: "idle",
    message: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings((prev) => ({
        ...prev,
        wc_url: data.wc_url || "",
        wc_consumer_key: data.wc_consumer_key || "",
        wc_consumer_secret: data.wc_consumer_secret || "",
        openrouter_api_key: data.openrouter_api_key || "",
        ai_model: data.ai_model || "deepseek/deepseek-chat-v3-0324:free",
      }));
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Settings saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testWooCommerce() {
    setWcTest({ status: "testing", message: "Testing..." });
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testType: "woocommerce" }),
      });
      const data = await res.json();
      setWcTest({
        status: data.success ? "success" : "error",
        message: data.message + (data.storeName ? ` (${data.storeName})` : ""),
      });
    } catch (err) {
      setWcTest({ status: "error", message: err instanceof Error ? err.message : "Test failed" });
    }
  }

  async function testAI() {
    setAiTest({ status: "testing", message: "Testing..." });
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testType: "ai" }),
      });
      const data = await res.json();
      setAiTest({
        status: data.success ? "success" : "error",
        message: data.message,
      });
    } catch (err) {
      setAiTest({ status: "error", message: err instanceof Error ? err.message : "Test failed" });
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const freeModels = [
    { id: "nvidia/nemotron-3-nano-30b-a3b:free", name: "Nemotron 3 Nano 30B (Recommended)" },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super 120B" },
    { id: "nvidia/nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B" },
    { id: "google/gemma-4-26b-a4b-it:free", name: "Google Gemma 4 26B" },
    { id: "qwen/qwen3-next-80b-a3b-instruct:free", name: "Qwen 3 Next 80B" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400">Configure your WooCommerce store and AI connection</p>
      </div>

      {/* WooCommerce Settings */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">WooCommerce Connection</h2>
        <p className="mb-4 text-sm text-gray-400">
          Enter your WooCommerce REST API credentials. Generate these from{" "}
          <span className="text-blue-400">WooCommerce &gt; Settings &gt; Advanced &gt; REST API</span> in your WordPress admin.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Store URL</label>
            <input
              type="url"
              value={settings.wc_url}
              onChange={(e) => setSettings({ ...settings, wc_url: e.target.value })}
              placeholder="https://yourstore.com"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Consumer Key</label>
            <input
              type="text"
              value={settings.wc_consumer_key}
              onChange={(e) => setSettings({ ...settings, wc_consumer_key: e.target.value })}
              placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Consumer Secret</label>
            <input
              type="password"
              value={settings.wc_consumer_secret}
              onChange={(e) => setSettings({ ...settings, wc_consumer_secret: e.target.value })}
              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={testWooCommerce}
              disabled={wcTest.status === "testing"}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {wcTest.status === "testing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : wcTest.status === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : wcTest.status === "error" ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : null}
              Test Connection
            </button>
            {wcTest.message && (
              <span className={`text-sm ${wcTest.status === "success" ? "text-green-400" : "text-red-400"}`}>
                {wcTest.message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* OpenRouter AI Settings */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">AI Connection (OpenRouter)</h2>
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-400 hover:underline"
          >
            Get free API key <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="mb-4 text-sm text-gray-400">
          OpenRouter gives you free access to multiple AI models. Sign up, get a free API key, and start optimizing products with AI.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">OpenRouter API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={settings.openrouter_api_key}
                onChange={(e) => setSettings({ ...settings, openrouter_api_key: e.target.value })}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">Free Model</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {freeModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSettings({ ...settings, ai_model: model.id })}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    settings.ai_model === model.id
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white"
                  }`}
                >
                  <p className="font-medium">{model.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{model.id}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={testAI}
              disabled={aiTest.status === "testing"}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {aiTest.status === "testing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : aiTest.status === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : aiTest.status === "error" ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : null}
              Test AI Connection
            </button>
            {aiTest.message && (
              <span className={`text-sm ${aiTest.status === "success" ? "text-green-400" : "text-red-400"}`}>
                {aiTest.message}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
