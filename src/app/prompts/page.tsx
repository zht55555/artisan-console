"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PromptTemplate = {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string[];
  updatedAt: string;
};

type JsonValue =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export default function PromptTemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [name, setName] = useState("电商产品图模板");
  const [description, setDescription] = useState("用于快速生成主图场景描述");
  const [template, setTemplate] = useState(
    "为{{product_name}}生成一张{{style}}风格产品主图，背景是{{scene}}，镜头语言{{camera}}。",
  );
  const [valuesJson, setValuesJson] = useState(
    JSON.stringify(
      {
        product_name: "无线耳机",
        style: "极简高级",
        scene: "白色亚克力台面",
        camera: "85mm 特写",
      },
      null,
      2,
    ),
  );
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<JsonValue>(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [templates, selectedId],
  );

  async function requestJson(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const data = await response
      .json()
      .catch(() => ({ ok: false, error: "invalid_json" }));

    if (!response.ok) {
      return { ok: false, status: response.status, data };
    }

    return data;
  }

  const refreshTemplates = useCallback(async () => {
    const result = await requestJson("/api/v1/prompt-templates");
    if (
      result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      "templates" in result &&
      Array.isArray(result.templates)
    ) {
      const list = result.templates as PromptTemplate[];
      setTemplates(list);
      setSelectedId((current) => current || list[0]?.id || "");
    }
    setOutput(result);
  }, []);

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    try {
      const result = await action();
      setOutput(result as JsonValue);
      await refreshTemplates();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  return (
    <main className="vf-bg min-h-screen">
      <div className="vf-grid min-h-screen">
        <div className="mx-auto grid w-full max-w-6xl gap-5 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-10">
          <section className="vf-card space-y-4 rounded-2xl p-5">
            <p className="vf-muted text-xs">Batch 5</p>
            <h1 className="text-2xl font-semibold">Prompt 模板工作台</h1>
            <p className="vf-muted text-sm">
              支持模板 CRUD、变量提取与一键套用。
            </p>

            <div className="space-y-2">
              <label className="text-sm">模板名</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">描述</label>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">
                模板正文（变量格式: {"{{name}}"}）
              </label>
              <textarea
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
                className="h-40 w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  run(() =>
                    requestJson("/api/v1/prompt-templates", {
                      method: "POST",
                      body: JSON.stringify({ name, description, template }),
                    }),
                  )
                }
                className="vf-btn-primary rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                新建模板
              </button>

              <button
                type="button"
                disabled={loading || !selectedId}
                onClick={() =>
                  run(() =>
                    requestJson(`/api/v1/prompt-templates/${selectedId}`, {
                      method: "PATCH",
                      body: JSON.stringify({ name, description, template }),
                    }),
                  )
                }
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                更新所选
              </button>

              <button
                type="button"
                disabled={loading || !selectedId}
                onClick={() =>
                  run(() =>
                    requestJson(`/api/v1/prompt-templates/${selectedId}`, {
                      method: "DELETE",
                    }),
                  )
                }
                className="rounded-xl border border-red-300/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 disabled:opacity-50"
              >
                删除所选
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm">变量 JSON</label>
              <textarea
                value={valuesJson}
                onChange={(event) => setValuesJson(event.target.value)}
                className="h-40 w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-xs"
              />
            </div>

            <button
              type="button"
              disabled={loading || !selectedId}
              onClick={() =>
                run(() => {
                  let values: Record<string, string | number | boolean> = {};
                  try {
                    values = JSON.parse(valuesJson) as Record<
                      string,
                      string | number | boolean
                    >;
                  } catch {
                    return Promise.resolve({
                      ok: false,
                      error: "invalid_values_json",
                    });
                  }

                  return requestJson(
                    `/api/v1/prompt-templates/${selectedId}/apply`,
                    {
                      method: "POST",
                      body: JSON.stringify({ values }),
                    },
                  );
                })
              }
              className="vf-btn-primary rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              套用模板并预览 Prompt
            </button>
          </section>

          <section className="space-y-5">
            <article className="vf-card rounded-2xl p-4">
              <h2 className="mb-3 text-sm font-medium">模板列表</h2>
              <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                {templates.length === 0 ? (
                  <p className="vf-muted text-sm">暂无模板，先创建一个。</p>
                ) : null}

                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setName(item.name);
                      setDescription(item.description ?? "");
                      setTemplate(item.template);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      item.id === selectedId
                        ? "border-blue-300/50 bg-blue-400/10"
                        : "border-white/15 bg-white/5"
                    }`}
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="vf-muted mt-1 line-clamp-2 text-xs">
                      {item.description || "-"}
                    </p>
                    <p className="vf-muted mt-2 text-[11px]">
                      vars: {(item.variables || []).join(", ") || "none"}
                    </p>
                  </button>
                ))}
              </div>
            </article>

            <article className="vf-card rounded-2xl p-4">
              <h2 className="mb-2 text-sm font-medium">当前选中</h2>
              <p className="vf-muted text-xs">
                {selectedTemplate?.id || "未选择"}
              </p>
              <p className="mt-2 text-sm">{selectedTemplate?.name || "-"}</p>
              <p className="vf-muted mt-1 text-xs">
                {(selectedTemplate?.variables || []).join(", ") || "无变量"}
              </p>
            </article>

            <article className="vf-card rounded-2xl p-4">
              <h2 className="mb-2 text-sm font-medium">接口输出</h2>
              <pre className="max-h-[320px] overflow-auto rounded-xl border border-white/10 bg-black/60 p-3 text-xs text-zinc-100">
                {JSON.stringify(output, null, 2)}
              </pre>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
