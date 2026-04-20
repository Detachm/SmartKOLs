"use client";

import { useState } from "react";
import { useMockStore } from "@/lib/mock-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Link2, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Method = "apikey" | "oauth";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddAccountModal({ open, onClose }: Props) {
  const { addAccount } = useMockStore();
  const [method, setMethod] = useState<Method>("apikey");
  const [step, setStep] = useState<"method" | "form" | "done">("method");

  // API Key form
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessSecret, setAccessSecret] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
    addAccount({
      id: `acc_${Date.now()}`,
      handle: cleanHandle,
      displayName: displayName || cleanHandle,
      avatarSeed: handle.replace("@", "").toLowerCase(),
      followersCount: 0,
      followingCount: 0,
      tweetsCount: 0,
      active: true,
      createdAt: new Date().toISOString().split("T")[0],
    });
    setLoading(false);
    setStep("done");
  };

  const handleOAuth = async () => {
    setLoading(true);
    addAccount({
      id: `acc_${Date.now()}`,
      handle: "@oauth_user",
      displayName: "OAuth 授权账号",
      avatarSeed: `oauth_${Date.now()}`,
      followersCount: 0, followingCount: 0, tweetsCount: 0,
      active: true,
      createdAt: new Date().toISOString().split("T")[0],
    });
    setLoading(false);
    setStep("done");
  };

  const handleClose = () => {
    setStep("method"); setMethod("apikey");
    setApiKey(""); setApiSecret(""); setAccessToken(""); setAccessSecret("");
    setHandle(""); setDisplayName(""); setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>连接 Twitter 账号</DialogTitle>
          <DialogDescription>选择连接方式将 Twitter 账号接入 SmartKOLs</DialogDescription>
        </DialogHeader>

        {step === "method" && (
          <div className="space-y-3">
            {[
              { key: "apikey" as Method, icon: KeyRound, title: "API Key 连接（推荐）", desc: "通过 Twitter Developer API 密钥连接，适合批量管理" },
              { key: "oauth" as Method, icon: Link2, title: "OAuth 授权连接", desc: "通过 Twitter 官方授权登录，适合单账号授权" },
            ].map(({ key, icon: Icon, title, desc }) => (
              <button
                key={key}
                onClick={() => { setMethod(key); setStep("form"); }}
                className={cn("w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors hover:border-[#E0E0E0] hover:bg-white/[0.04]", "border-[#E8E8E8] bg-white")}
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

        {step === "form" && method === "apikey" && (
          <div className="space-y-4">
            <button onClick={() => setStep("method")} className="text-xs text-[#999999] hover:text-[#333333] flex items-center gap-1">← 返回</button>
            <div className="bg-white/[0.04] border border-[#E8E8E8] rounded-lg px-4 py-3 text-xs text-[#111111]">
              需要在 <span className="underline">developer.twitter.com</span> 申请 Developer App，获取以下 4 个密钥。
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">API Key</label>
                <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="xxxxxxxxxx" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">API Secret</label>
                <Input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="xxxxxxxxxx" type="password" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Access Token</label>
                <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="xxxxxxxxxx" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Access Token Secret</label>
                <Input value={accessSecret} onChange={(e) => setAccessSecret(e.target.value)} placeholder="xxxxxxxxxx" type="password" />
              </div>
            </div>
            <div className="border-t border-[#E8E8E8] pt-3 space-y-3">
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Twitter Handle</label>
                <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">显示名称</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：Alex Chen" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep("method")}>取消</Button>
              <Button onClick={handleConnect} disabled={!apiKey || !handle || loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />连接中...</> : "验证并连接"}
              </Button>
            </div>
          </div>
        )}

        {step === "form" && method === "oauth" && (
          <div className="space-y-4">
            <button onClick={() => setStep("method")} className="text-xs text-[#999999] hover:text-[#333333] flex items-center gap-1">← 返回</button>
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center mx-auto">
                <Link2 className="w-6 h-6 text-[#1DA1F2]" />
              </div>
              <div>
                <p className="text-[#111111] font-medium text-sm">跳转至 Twitter 授权页面</p>
                <p className="text-[#999999] text-xs mt-1">点击下方按钮，使用 Twitter 账号登录授权</p>
              </div>
              <Button onClick={handleOAuth} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />授权中...</> : "使用 Twitter 授权登录"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle className="w-12 h-12 mx-auto text-[#00BA7C]" />
            <p className="text-[#111111] font-medium">账号连接成功</p>
            <p className="text-[#999999] text-xs">现在可以配置人格和自动发帖了</p>
            <Button className="mt-2" onClick={handleClose}>完成</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
