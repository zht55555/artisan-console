"use client";

import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/retry";
import { useTranslations } from "next-intl";

type HistoryItem = {
  type: "chat" | "image" | "edit";
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  createdAt: string;
};

export default function HistoryPage() {
  const t = useTranslations("history");
  const FILTERS: Array<{
    value: "all" | "chat" | "image" | "edit";
    label: string;
  }> = [
    { value: "all", label: t("filters.all") },
    { value: "chat", label: t("filters.chat") },
    { value: "image", label: t("filters.image") },
    { value: "edit", label: t("filters.edit") },
  ];

  const [filter, setFilter] = useState<"all" | "chat" | "image" | "edit">(
    "all",
  );
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetchWithRetry(`/api/v1/history?type=${filter}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || t("loadFailed"));
        setItems(d.items || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [filter, t]);

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>

        <div className="mt-5 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                filter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          {loading && (
            <div className="text-sm text-muted-foreground">
              {t("loading")}
            </div>
          )}
          {error && <div className="text-sm text-red-500">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded-xl border border-border p-3"
              >
                <div className="text-sm font-medium">
                  [{item.type}] {item.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  status: {item.status}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  updated: {new Date(item.updatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
