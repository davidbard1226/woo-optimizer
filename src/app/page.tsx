"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, TrendingUp, AlertTriangle, Zap, ArrowRight } from "lucide-react";

interface Stats {
  totalProducts: number;
  scannedProducts: number;
  avgHealthScore: number;
  lowScoreProducts: number;
  recentOptimizations: number;
  buckets: { excellent: number; good: number; fair: number; poor: number };
  lowestScoring: { id: number; name: string; score: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load analytics");
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-red-400">{error}</p>
        <Link href="/settings" className="mt-3 inline-block text-sm text-blue-400 hover:underline">
          Configure Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Overview of your WooCommerce product optimization</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Package className="h-5 w-5 text-blue-400" />}
          label="Total Products"
          value={stats?.totalProducts ?? 0}
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-green-400" />}
          label="Avg Health Score"
          value={`${stats?.avgHealthScore ?? 0}%`}
          bg="bg-green-500/10"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-orange-400" />}
          label="Needs Improvement"
          value={stats?.lowScoreProducts ?? 0}
          bg="bg-orange-500/10"
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-purple-400" />}
          label="Optimized Today"
          value={stats?.recentOptimizations ?? 0}
          bg="bg-purple-500/10"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickAction
          title="Optimize Products"
          description="View and optimize individual products with AI"
          href="/products"
          icon={<Package className="h-5 w-5" />}
        />
        <QuickAction
          title="Bulk Optimize"
          description="Optimize multiple products at once"
          href="/bulk"
          icon={<Zap className="h-5 w-5" />}
        />
        <QuickAction
          title="Image Audit"
          description="Check and fix product images"
          href="/images"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <QuickAction
          title="Settings"
          description="Configure WooCommerce and AI connections"
          href="/settings"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {stats && stats.scannedProducts > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-300">
              Health Score Distribution
              {stats.scannedProducts < stats.totalProducts && (
                <span className="ml-2 text-xs text-gray-500">
                  (scanned {stats.scannedProducts} of {stats.totalProducts})
                </span>
              )}
            </h3>
            <div className="space-y-3">
              {[
                { label: "Excellent (80-100)", value: stats.buckets.excellent, color: "bg-green-500" },
                { label: "Good (60-79)", value: stats.buckets.good, color: "bg-blue-500" },
                { label: "Fair (40-59)", value: stats.buckets.fair, color: "bg-yellow-500" },
                { label: "Poor (0-39)", value: stats.buckets.poor, color: "bg-red-500" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-gray-400">{b.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full ${b.color}`}
                      style={{ width: `${(b.value / stats.scannedProducts) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-gray-500">{b.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-300">Fix These First</h3>
            <div className="space-y-1">
              {stats.lowestScoring.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-gray-800"
                >
                  <span className="truncate text-gray-300">{p.name}</span>
                  <span
                    className={`ml-2 rounded px-2 py-0.5 text-xs ${
                      p.score < 40 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {p.score}
                  </span>
                </Link>
              ))}
              {stats.lowestScoring.length === 0 && (
                <p className="text-sm text-gray-500">No products scanned yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2 ${bg}`}>{icon}</div>
      </div>
      <p className="mt-4 text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700 hover:bg-gray-800"
    >
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-blue-500/10 p-3 text-blue-400">{icon}</div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-gray-500 transition-colors group-hover:text-white" />
    </Link>
  );
}
