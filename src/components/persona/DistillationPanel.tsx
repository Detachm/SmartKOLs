"use client";

import { useState } from "react";
import { Persona } from "@/lib/mock-store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

const MOCK_EXTRACTED: Partial<Persona> = {
  gender: "male",
  nationality: "American",
  age: 30,
  interests: ["technology", "startups", "AI", "crypto"],
  personalityTraits: ["witty", "analytical", "direct", "opinionated"],
  writingStyle: "short punchy sentences, often uses rhetorical questions",
  bio: "Building things. Thinking out loud. Occasionally right.",
};

interface Props {
  currentPersona: Persona;
  onExtracted: (persona: Persona) => void;
}

export default function DistillationPanel({ currentPersona, onExtracted }: Props) {
  const [tweets, setTweets] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleExtract = async () => {
    if (!tweets.trim()) return;
    setLoading(true);
    setDone(false);
    const extracted = { ...currentPersona, ...MOCK_EXTRACTED };
    onExtracted(extracted);
    setLoading(false);
    setDone(true);
  };

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#111111]" />
          <h3 className="text-[#111111] font-semibold text-sm">人格蒸馏</h3>
        </div>
        <p className="text-[#999999] text-xs">
          粘贴该账号的 5~20 条历史推文，AI 将自动提取其人格特征并填入左侧表单。
        </p>
      </div>

      <Textarea
        value={tweets}
        onChange={(e) => setTweets(e.target.value)}
        placeholder={"在此粘贴推文，每行一条...\n\n示例：\n刚上线了一个新功能 🚀\n大胆预测：大多数 SaaS 不过是有 UI 的 Excel\n..."}
        rows={8}
        className="text-xs"
      />

      <Button
        onClick={handleExtract}
        disabled={!tweets.trim() || loading}
        className="w-full"
        variant={done ? "secondary" : "default"}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            正在提取人格...
          </>
        ) : done ? (
          "✓ 提取成功 — 请查看左侧表单"
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            提取人格
          </>
        )}
      </Button>
    </div>
  );
}
