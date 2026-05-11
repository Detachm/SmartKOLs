"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Sparkles, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWorkspace } from "@/lib/live-api";
import { loginLocalSession } from "@/lib/session-client";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function LoginClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected") === "1";
  const connectedAccountId = searchParams.get("account_id");
  const [email, setEmail] = useState("liuhan010407@gmail.com");
  const [name, setName] = useState("Operator");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("test");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateWorkspace() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createWorkspace({
        name: workspaceName,
        slug: workspaceSlug || toSlug(workspaceName),
      });
      setCreatingWorkspace(false);
      setWorkspaceName(created.name);
      setWorkspaceSlug(created.slug);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建 workspace 失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin() {
    if (!workspaceSlug.trim()) {
      setError("请先填写 workspace slug");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await loginLocalSession({
        email,
        name,
        workspace_slug: workspaceSlug,
      });
      router.push(searchParams.get("next") || "/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-[#F7F7F7] p-4">
      <div className="mx-auto grid min-h-full max-w-6xl grid-cols-1 overflow-hidden rounded-[28px] border border-[#E8E8E8] bg-white shadow-[0_24px_80px_rgba(17,17,17,0.08)] md:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_40%),linear-gradient(135deg,#111111_0%,#202020_45%,#313131_100%)] p-10 text-white md:p-14">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-black text-[#111111]">
              SK
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">SmartKOLs</p>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Local Auth</p>
            </div>
          </div>

          <div className="max-w-xl space-y-4">
            <h1 className="text-4xl font-bold leading-tight">一个后台，统一管理账号、内容与互动</h1>
            <p className="text-sm leading-6 text-white/70">
              在同一个工作区里管理账号人格、信息源、草稿审核、排期发布和互动自动化，
              让团队协作更清晰，日常运营更高效。
            </p>
          </div>

          <div className="mt-12 space-y-5">
            {[
              {
                icon: Sparkles,
                title: "账号矩阵统一管理",
                detail: "每个账号都能独立配置人格、风格、信息源和自动化策略。",
              },
              {
                icon: Users,
                title: "内容生产一条链完成",
                detail: "从选题、成稿、审核到排期发布，都在同一个工作区里推进。",
              },
              {
                icon: Zap,
                title: "团队协作更清晰",
                detail: "运营、审核和管理动作集中在一个入口里，减少来回沟通和切换。",
              },
              {
                icon: Shield,
                title: "运行状态清晰可见",
                detail: "发帖、互动、排期和异常状态都可以在页面里直接查看和处理。",
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-white/55">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-8 md:p-12">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[#999999]">Workspace Access</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#111111]">工作区登录</h2>
            <p className="text-sm text-[#666666]">
              输入工作区、邮箱和姓名后进入控制台。如果是新环境，也可以先创建一个工作区。
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          {connected ? (
            <div className="mt-6 rounded-2xl border border-[#D7F3E6] bg-[#F4FCF8] px-4 py-3 text-sm text-[#0F6B45]">
              X 账号绑定已完成{connectedAccountId ? `（账号 ID：${connectedAccountId}）` : ""}。请重新登录工作区，继续后续配置和运营操作。
            </div>
          ) : null}

          <div className="mt-8 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#111111]">工作区标识</label>
                <button
                  type="button"
                  onClick={() => setCreatingWorkspace((value) => !value)}
                  className="text-sm text-[#111111] underline underline-offset-4"
                >
                  {creatingWorkspace ? "关闭创建" : "创建 workspace"}
                </button>
              </div>

              <Input
                value={workspaceSlug}
                onChange={(event) => setWorkspaceSlug(toSlug(event.target.value))}
                placeholder="例如：team-alpha"
              />
              <p className="text-xs leading-5 text-[#777777]">
                已有工作区请输入标识；如果是首次使用，可以先创建一个新的工作区。
              </p>

              {creatingWorkspace ? (
                <div className="rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] p-4">
                  <div className="grid gap-3">
                    <Input
                      value={workspaceName}
                      onChange={(event) => {
                        const value = event.target.value;
                        setWorkspaceName(value);
                        if (!workspaceSlug) {
                          setWorkspaceSlug(toSlug(value));
                        }
                      }}
                      placeholder="Workspace 名称"
                    />
                    <Input
                      value={workspaceSlug}
                      onChange={(event) => setWorkspaceSlug(toSlug(event.target.value))}
                      placeholder="workspace-slug"
                    />
                    <Button onClick={() => void handleCreateWorkspace()} disabled={submitting || !workspaceName.trim()}>
                      创建 workspace
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#111111]">邮箱</label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#111111]">姓名</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="你的名字" />
            </div>

            <Button
              className="w-full"
              onClick={() => void handleLogin()}
              disabled={submitting || !workspaceSlug.trim() || !email.trim() || !name.trim()}
            >
              {submitting ? "进入中..." : "登录并进入控制台"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
