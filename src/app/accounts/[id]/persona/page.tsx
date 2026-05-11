"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PersonaForm, { type PersonaFormValue } from "@/components/persona/PersonaForm";
import DistillationPanel from "@/components/persona/DistillationPanel";
import HealthCard from "@/components/accounts/HealthCard";
import { Button } from "@/components/ui/button";
import { getPersona, updatePersona, type BackendPersona } from "@/lib/live-api";
import { getLiveSession } from "@/lib/session-client";
import { notifyAccountReadinessChanged } from "@/lib/account-readiness-refresh";

const DEFAULT_PERSONA: PersonaFormValue = {
  gender: "unknown",
  nationality: "",
  age: 25,
  interests: [],
  personalityTraits: [],
  writingStyle: "",
  bio: "",
  distillationSampleTweets: "",
};

function toFormValue(persona: BackendPersona | null): PersonaFormValue {
  if (!persona) {
    return DEFAULT_PERSONA;
  }

  return {
    gender: persona.gender,
    nationality: persona.nationality,
    age: persona.age,
    interests: persona.interests,
    personalityTraits: persona.personality_traits,
    writingStyle: persona.writing_style,
    bio: persona.bio,
    distillationSampleTweets: persona.distillation_sample_tweets,
  };
}

export default function PersonaPage() {
  const params = useParams();
  const id = params.id as string;
  const [persona, setPersona] = useState<BackendPersona | null>(null);
  const [currentPersona, setCurrentPersona] = useState<PersonaFormValue>(DEFAULT_PERSONA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPersona = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPersona(id);
      const nextPersona = response?.persona ?? null;
      setPersona(nextPersona);
      setCurrentPersona(toFormValue(nextPersona));
    } catch (cause) {
      setPersona(null);
      setCurrentPersona(DEFAULT_PERSONA);
      setError(cause instanceof Error ? cause.message : "加载人格配置失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPersona();
  }, [loadPersona]);

  const handleSave = async (nextPersona: PersonaFormValue) => {
    const session = await getLiveSession();
    const saved = await updatePersona(id, {
      workspace_id: session.selected_workspace.id,
      gender: nextPersona.gender,
      nationality: nextPersona.nationality,
      age: nextPersona.age,
      interests: nextPersona.interests,
      personality_traits: nextPersona.personalityTraits,
      writing_style: nextPersona.writingStyle,
      bio: nextPersona.bio,
      distillation_sample_tweets: nextPersona.distillationSampleTweets,
      source: "manual",
      actor_type: "user",
      actor_id: session.user.id,
    });
    setPersona(saved);
    setCurrentPersona(toFormValue(saved));
    setNotice("人格配置已保存到后端");
    notifyAccountReadinessChanged(id);
  };

  const handleDistillationQueued = async () => {
    setNotice("人格蒸馏任务已排队；完成后刷新即可看到写回结果");
    await loadPersona();
    notifyAccountReadinessChanged(id);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#111111] mb-1">人格配置</h2>
          <p className="text-[#999999] text-sm">
            为该 AI KOL 账号定义人格背景与特征。当前页面读取并保存真实后端 persona。
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadPersona()} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-[#F2D5D5] bg-[#FFF7F7] px-4 py-3 text-sm text-[#D93025]">
          {error}
        </div>
      ) : null}

      {!loading && !persona ? (
        <div className="mb-4 rounded-xl border border-[#F3E6C7] bg-[#FFF9EF] px-4 py-3 text-sm text-[#8A6500]">
          当前账号还没有保存过人格配置。填写后保存即可补齐 activation checklist。
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div data-tour="persona-form">
          <PersonaForm
            accountId={id}
            persona={currentPersona}
            onSaved={handleSave}
          />
          {notice ? (
            <p className="text-[#00BA7C] text-sm mt-3 text-center">{notice}</p>
          ) : null}
        </div>
        <div className="space-y-6">
          <HealthCard accountId={id} />
          <DistillationPanel
            accountId={id}
            onQueued={handleDistillationQueued}
          />
        </div>
      </div>
    </div>
  );
}
