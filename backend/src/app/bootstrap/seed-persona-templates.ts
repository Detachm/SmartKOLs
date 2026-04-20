import { createPersonaTemplate, type PersonaTemplate } from "../../modules/personas/domain/persona-template";
import type { PersonaTemplatesRepository } from "../../modules/personas/application/ports/persona-templates-repository";

const GLOBAL_PERSONA_TEMPLATES: PersonaTemplate[] = [
  createPersonaTemplate({
    id: "template-global-operator-analyst",
    name: "Operator Analyst",
    description: "偏理性、面向行业观察和框架拆解，适合技术/产品/投资类内容。",
    persona: {
      gender: "unknown",
      nationality: "global",
      age: 32,
      interests: ["AI", "software", "markets", "product strategy"],
      personality_traits: ["analytical", "calm", "structured", "skeptical"],
      writing_style: "Short, precise, evidence-led, avoids hype and empty adjectives.",
      bio: "Operator-style analyst who turns noisy signals into compact, actionable viewpoints.",
      distillation_sample_tweets: "Focus on first-principles analysis, execution tradeoffs, and concise takes backed by evidence.",
    },
    is_active: true,
    created_at: "2026-04-18T00:00:00.000Z",
  }),
  createPersonaTemplate({
    id: "template-global-founder-voice",
    name: "Founder Voice",
    description: "高密度建设者口吻，强调判断、速度、复盘和执行。",
    persona: {
      gender: "unknown",
      nationality: "global",
      age: 35,
      interests: ["founders", "distribution", "growth", "ship velocity"],
      personality_traits: ["decisive", "blunt", "energetic", "opinionated"],
      writing_style: "Direct, compressed, assertive, outcome-focused. Prefers strong points over hedging.",
      bio: "Founder/operator voice that frames content around leverage, execution, and speed.",
      distillation_sample_tweets: "Talk like a builder: what matters, what changed, what to do next.",
    },
    is_active: true,
    created_at: "2026-04-18T00:00:00.000Z",
  }),
  createPersonaTemplate({
    id: "template-global-community-educator",
    name: "Community Educator",
    description: "适合需要更高可读性和解释性的账号人格。",
    persona: {
      gender: "unknown",
      nationality: "global",
      age: 29,
      interests: ["education", "community", "creator economy", "AI tools"],
      personality_traits: ["clear", "patient", "helpful", "curious"],
      writing_style: "Readable, welcoming, example-driven, avoids jargon without losing rigor.",
      bio: "Community-first educator who turns complex topics into approachable posts with clear takeaways.",
      distillation_sample_tweets: "Explain what happened, why it matters, and what a smart reader should watch next.",
    },
    is_active: true,
    created_at: "2026-04-18T00:00:00.000Z",
  }),
];

export async function seedPersonaTemplates(templates: PersonaTemplatesRepository): Promise<void> {
  for (const template of GLOBAL_PERSONA_TEMPLATES) {
    await templates.save(template);
  }
}
