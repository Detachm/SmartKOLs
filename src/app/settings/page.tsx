"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMockStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { logoutLiveSession } from "@/lib/session-client";
import { CheckCircle, LogOut, UserPlus, RotateCcw, Users } from "lucide-react";

export default function SettingsPage() {
  const { teamMembers, resetDemo } = useMockStore();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [aiModel, setAiModel] = useState("claude-sonnet-4-6");
  const [apiKey, setApiKey] = useState("");
  const [autoSave, setAutoSave] = useState(true);
  const [language, setLanguage] = useState("zh");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = () => {
    void logoutLiveSession().finally(() => {
      router.push("/login");
    });
  };

  const handleReset = () => {
    if (confirm("确定要重置所有 Demo 数据吗？已修改的账号、人格、配置将全部恢复到初始状态。")) {
      resetDemo();
    }
  };

  const roleColors: Record<string, string> = {
    Owner: "bg-[#111111] text-white",
    Admin: "bg-purple-100 text-purple-700",
    Editor: "bg-blue-100 text-blue-700",
    Viewer: "bg-[#F0F0F0] text-[#999999]",
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111111]">设置</h1>
        <p className="text-[#999999] text-sm mt-1">系统配置、团队成员与账户管理</p>
      </div>

      <div className="space-y-6">
        {/* AI Model */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <h2 className="text-[#111111] font-semibold text-sm">AI 模型配置</h2>
          <div>
            <label className="text-xs text-[#999999] mb-1.5 block">Claude API Key</label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-..." type="password" />
            <p className="text-[#999999] text-xs mt-1">用于人格蒸馏和推文生成功能</p>
          </div>
          <div>
            <label className="text-xs text-[#999999] mb-2 block">模型选择</label>
            <div className="flex gap-2">
              {[{ v: "claude-sonnet-4-6", l: "Claude Sonnet（推荐）" }, { v: "claude-haiku-4-5", l: "Claude Haiku（快速）" }].map(({ v, l }) => (
                <button key={v} onClick={() => setAiModel(v)} className={`px-3 py-2 rounded-lg text-xs border transition-colors ${aiModel === v ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* General */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <h2 className="text-[#111111] font-semibold text-sm">通用设置</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#111111] text-sm">自动保存配置</p>
              <p className="text-[#999999] text-xs">修改人格/发帖配置时自动保存</p>
            </div>
            <Switch checked={autoSave} onCheckedChange={setAutoSave} />
          </div>
          <div>
            <label className="text-xs text-[#999999] mb-2 block">界面语言</label>
            <div className="flex gap-2">
              {[{ v: "zh", l: "中文" }, { v: "en", l: "English" }].map(({ v, l }) => (
                <button key={v} onClick={() => setLanguage(v)} className={`px-3 py-2 rounded-lg text-xs border transition-colors ${language === v ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[#111111] font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              团队成员
              <span className="text-xs text-[#999999] font-normal">· {teamMembers.length} 人</span>
            </h2>
            <Button size="sm" variant="outline">
              <UserPlus className="w-3.5 h-3.5 mr-1" />邀请成员
            </Button>
          </div>
          <div className="space-y-2">
            {teamMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <img
                  src={`https://unavatar.io/twitter/${m.avatarSeed}`}
                  alt=""
                  className="w-9 h-9 rounded-full bg-[#E8E8E8] flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.avatarSeed}`; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[#111111] text-sm font-medium">{m.name}</p>
                  <p className="text-[#999999] text-xs">{m.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleColors[m.role] || "bg-[#F0F0F0] text-[#999999]"}`}>{m.role}</span>
                <span className="text-xs text-[#999999] ml-2">{m.lastActive}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <h2 className="text-[#111111] font-semibold text-sm">账户操作</h2>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />重置 Demo 数据
            </Button>
            <Button variant="outline" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200">
              <LogOut className="w-3.5 h-3.5 mr-1.5" />退出登录
            </Button>
          </div>
          <p className="text-xs text-[#999999]">重置会清除所有本地修改（包括随机生成的人格、批准的草稿等），恢复到初始 Mock 数据。</p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>保存设置</Button>
          {saved && <span className="text-[#00BA7C] text-sm flex items-center gap-1.5"><CheckCircle className="w-4 h-4" />已保存</span>}
        </div>
      </div>
    </div>
  );
}
