"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Link2, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  syncAccountProfile,
  upsertAccountCredential,
  validateAccountCredential,
  type BackendAccount,
} from "@/lib/live-api";
import { getLiveSession } from "@/lib/session-client";

type Method = "access_token" | "oauth";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ConnectedAccountSummary {
  id: string;
  handle: string;
  displayName: string;
}

function normalizeHandle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function isConflictErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("already exists") || normalized.includes("handle already exists") || normalized.includes("conflict");
}

export default function AddAccountModal({ open, onClose }: Props) {
  const [method, setMethod] = useState<Method>("access_token");
  const [step, setStep] = useState<"method" | "form" | "done">("method");
  const [accessToken, setAccessToken] = useState("");
  const [accessSecret, setAccessSecret] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccountSummary | null>(null);

  const resetState = () => {
    setMethod("access_token");
    setStep("method");
    setAccessToken("");
    setAccessSecret("");
    setHandle("");
    setDisplayName("");
    setLoading(false);
    setError(null);
    setConnectedAccount(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const resolveTargetAccount = async (workspaceId: string, cleanHandle: string, cleanDisplayName: string) => {
    const existingAccounts = await listAccounts(workspaceId);
    const existingAccount = existingAccounts.accounts.find(
      (account) => normalizeHandle(account.handle).toLowerCase() === cleanHandle.toLowerCase(),
    );
    if (existingAccount) {
      return {
        account: existingAccount satisfies Pick<BackendAccount, "id" | "handle" | "display_name">,
        created: false,
      };
    }

    try {
      const created = await createAccount({
        workspace_id: workspaceId,
        platform: "x",
        handle: cleanHandle,
        display_name: cleanDisplayName,
      });
      return {
        account: created,
        created: true,
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "创建账号失败";
      if (!isConflictErrorMessage(message)) {
        throw cause;
      }

      const refreshed = await listAccounts(workspaceId);
      const conflicted = refreshed.accounts.find((account) => normalizeHandle(account.handle).toLowerCase() === cleanHandle.toLowerCase());
      if (!conflicted) {
        throw cause;
      }

      return {
        account: conflicted,
        created: false,
      };
    }
  };

  const handleAccessTokenConnect = async () => {
    const cleanHandle = normalizeHandle(handle);
    const cleanDisplayName = displayName.trim() || cleanHandle;
    if (!cleanHandle || !accessToken.trim() || !accessSecret.trim()) {
      setError("请填写账号 handle、Access Token 和 Access Token Secret。");
      return;
    }

    setLoading(true);
    setError(null);

    let createdAccountId: string | null = null;
    try {
      const session = await getLiveSession();
      const target = await resolveTargetAccount(session.selected_workspace.id, cleanHandle, cleanDisplayName);
      createdAccountId = target.created ? target.account.id : null;

      await upsertAccountCredential(target.account.id, {
        provider: "x_oauth1",
        status: "valid",
        oauth1_token: {
          access_token: accessToken.trim(),
          access_token_secret: accessSecret.trim(),
        },
      });
      await validateAccountCredential(target.account.id);
      const synced = await syncAccountProfile(target.account.id);

      setConnectedAccount({
        id: synced.account.id,
        handle: synced.account.handle,
        displayName: synced.account.display_name,
      });
      setStep("done");
    } catch (cause) {
      let message = cause instanceof Error ? cause.message : "账号连接失败";
      if (createdAccountId) {
        try {
          await deleteAccount(createdAccountId);
        } catch (cleanupError) {
          const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "新建账号回滚失败";
          message = `${message}；另外回滚新建账号时失败：${cleanupMessage}`;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getLiveSession();
      const workspaceSlug = session.selected_workspace.slug.trim();
      const target = workspaceSlug
        ? `/auth/x/start?workspace_slug=${encodeURIComponent(workspaceSlug)}`
        : "/auth/x/start";
      window.location.assign(target);
    } catch (cause) {
      setLoading(false);
      setError(cause instanceof Error ? cause.message : "无法读取当前工作区，跳转授权失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>连接 X 账号</DialogTitle>
          <DialogDescription>只保留真实可用的绑定链路，不再创建本地占位账号。</DialogDescription>
        </DialogHeader>

        {step === "method" && (
          <div className="space-y-3">
            {[
              {
                key: "access_token" as Method,
                icon: KeyRound,
                title: "Access Token 连接",
                desc: "录入账号级 Access Token / Secret，适合运营账号真实绑定。",
              },
              {
                key: "oauth" as Method,
                icon: Link2,
                title: "OAuth 授权连接",
                desc: "跳转到 X 官方授权页，回调后自动创建或绑定账号。",
              },
            ].map(({ key, icon: Icon, title, desc }) => (
              <button
                key={key}
                onClick={() => {
                  setMethod(key);
                  setStep("form");
                  setError(null);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors hover:border-[#E0E0E0] hover:bg-white/[0.04]",
                  "border-[#E8E8E8] bg-white",
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-[#E8E8E8] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#111111]" />
                </div>
                <div className="flex-1">
                  <p className="text-[#111111] text-sm font-medium">{title}</p>
                  <p className="text-[#999999] text-xs mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#999999]" />
              </button>
            ))}
          </div>
        )}

        {step === "form" && method === "access_token" && (
          <div className="space-y-4">
            <button onClick={() => setStep("method")} className="text-xs text-[#999999] hover:text-[#333333] flex items-center gap-1">
              ← 返回
            </button>

            <div className="bg-white/[0.04] border border-[#E8E8E8] rounded-lg px-4 py-3 text-xs text-[#111111]">
              系统级 Consumer Key / Secret 已由后端统一配置。
              这里录入账号自己的 <span className="font-medium">Access Token</span> 和 <span className="font-medium">Access Token Secret</span> 即可。
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">X Handle</label>
                <Input value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@username" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">显示名称（可选）</label>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="不填则先用 handle，成功后会自动同步真实资料" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Access Token</label>
                <Input value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="输入账号 access token" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Access Token Secret</label>
                <Input value={accessSecret} onChange={(event) => setAccessSecret(event.target.value)} placeholder="输入账号 access token secret" type="password" />
              </div>
            </div>

            {error ? <p className="text-xs text-red-500">{error}</p> : null}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep("method")} disabled={loading}>取消</Button>
              <Button onClick={() => void handleAccessTokenConnect()} disabled={loading || !handle.trim() || !accessToken.trim() || !accessSecret.trim()}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />绑定中...</> : "验证并绑定"}
              </Button>
            </div>
          </div>
        )}

        {step === "form" && method === "oauth" && (
          <div className="space-y-4">
            <button onClick={() => setStep("method")} className="text-xs text-[#999999] hover:text-[#333333] flex items-center gap-1">
              ← 返回
            </button>

            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center mx-auto">
                <Link2 className="w-6 h-6 text-[#1DA1F2]" />
              </div>
              <div>
                <p className="text-[#111111] font-medium text-sm">跳转至 X 授权页</p>
                <p className="text-[#999999] text-xs mt-1">授权成功后会自动创建或绑定账号、写入 credential、校验并同步资料。</p>
              </div>
              {error ? <p className="text-xs text-red-500">{error}</p> : null}
              <Button onClick={() => void handleOAuth()} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />跳转中...</> : "使用 X OAuth 授权"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && connectedAccount && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle className="w-12 h-12 mx-auto text-[#00BA7C]" />
            <p className="text-[#111111] font-medium">账号绑定成功</p>
            <p className="text-[#999999] text-xs">
              已绑定 {connectedAccount.displayName}（{connectedAccount.handle}）
            </p>
            <Button
              className="mt-2"
              onClick={() => {
                window.location.assign(`/accounts?connected=1&account_id=${encodeURIComponent(connectedAccount.id)}`);
              }}
            >
              返回账号列表
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
