import type { JsonSchema } from "../../../core/validation/json-schema";

export type AgentCode = "inbox-classifier" | "reply-proposer" | "brief-builder" | "writer" | "reviewer" | "persona-distiller";

export interface AgentArtifactBundle {
  definition: {
    id: string;
    code: AgentCode;
    name: string;
    version: string;
    input_schema: JsonSchema;
    output_schema: JsonSchema;
  };
  prompt: {
    ref: string;
    system_prompt: string;
    developer_prompt: string;
    input_schema_ref: string;
    output_schema_ref: string;
    input_schema: JsonSchema;
    output_schema: JsonSchema;
  };
  tool_policy: {
    ref: string;
    allowed_tools: string[];
  };
}

const AGENT_ARTIFACTS: AgentArtifactBundle[] = [
  {
    definition: {
      id: "agent-def-inbox-classifier",
      code: "inbox-classifier",
      name: "Inbox Classifier",
      version: "v1",
      input_schema: {
        type: "object",
        required: ["thread_id"],
        properties: {
          thread_id: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["classification", "reasoning_summary"],
        properties: {
          classification: {
            type: "string",
            enum: ["collab", "commerce", "spam", "normal", "support"],
          },
          reasoning_summary: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    prompt: {
      ref: "agent.prompt.inbox-classifier@v1",
      system_prompt: "You classify inbound social interactions for an operator console. Return only JSON.",
      developer_prompt: "Classify the thread into exactly one supported label and give a short reasoning summary grounded in the message content.",
      input_schema_ref: "agent.input.inbox-classifier@v1",
      output_schema_ref: "agent.output.inbox-classifier@v1",
      input_schema: {
        type: "object",
        required: ["thread_id", "channel", "messages"],
        properties: {
          thread_id: { type: "string", minLength: 1 },
          channel: {
            type: "string",
            enum: ["mention", "reply", "dm", "comment"],
          },
          messages: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["content", "created_at"],
              properties: {
                sender_handle: { type: "string" },
                content: { type: "string", minLength: 1 },
                created_at: { type: "string", minLength: 1 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["classification", "reasoning_summary"],
        properties: {
          classification: {
            type: "string",
            enum: ["collab", "commerce", "spam", "normal", "support"],
          },
          reasoning_summary: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    tool_policy: {
      ref: "agent.tool-policy.inbox-classifier@v1",
      allowed_tools: ["engagement.get_thread_context"],
    },
  },
  {
    definition: {
      id: "agent-def-reply-proposer",
      code: "reply-proposer",
      name: "Reply Proposer",
      version: "v1",
      input_schema: {
        type: "object",
        required: ["thread_id"],
        properties: {
          thread_id: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["content", "rationale"],
        properties: {
          content: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    prompt: {
      ref: "agent.prompt.reply-proposer@v1",
      system_prompt: "You draft a single reply proposal for a social media operator. Return only JSON.",
      developer_prompt: "Use the conversation context to propose one concise reply and explain why it is appropriate. If preferred_style is present, the reply must clearly follow that style without mentioning the style label.",
      input_schema_ref: "agent.input.reply-proposer@v1",
      output_schema_ref: "agent.output.reply-proposer@v1",
      input_schema: {
        type: "object",
        required: ["thread_id", "channel", "messages"],
        properties: {
          thread_id: { type: "string", minLength: 1 },
          channel: {
            type: "string",
            enum: ["mention", "reply", "dm", "comment"],
          },
          counterpart_handle: { type: "string" },
          preferred_style: { type: "string" },
          messages: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["content", "created_at"],
              properties: {
                sender_handle: { type: "string" },
                content: { type: "string", minLength: 1 },
                created_at: { type: "string", minLength: 1 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["content", "rationale"],
        properties: {
          content: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    tool_policy: {
      ref: "agent.tool-policy.reply-proposer@v1",
      allowed_tools: ["engagement.get_thread_context"],
    },
  },
  {
    definition: {
      id: "agent-def-brief-builder",
      code: "brief-builder",
      name: "Brief Builder",
      version: "v1",
      input_schema: {
        type: "object",
        required: ["brief_id"],
        properties: {
          brief_id: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["topic", "angle", "audience", "outline", "rationale", "evidence_items"],
        properties: {
          topic: { type: "string", minLength: 1 },
          angle: { type: "string", minLength: 1 },
          audience: { type: "string", minLength: 1 },
          outline: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
          evidence_items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["source_document_id", "usage_reason", "key_claims"],
              properties: {
                source_document_id: { type: "string", minLength: 1 },
                usage_reason: { type: "string", minLength: 1 },
                key_claims: {
                  type: "array",
                  minItems: 1,
                  items: { type: "string", minLength: 1 },
                },
                quoted_excerpt: { type: "string" },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
    prompt: {
      ref: "agent.prompt.brief-builder@v1",
      system_prompt: "You turn external source documents into an operator-facing social content brief. Return only JSON.",
      developer_prompt: [
        "Build one concise content brief grounded only in the supplied documents.",
        "The brief is for a single native X post, not a campaign slogan, brand manifesto, or thread outline.",
        "topic should be specific and source-backed.",
        "angle should be one human-readable take with a concrete tradeoff, tension, or implication.",
        "audience should describe who would care, not a broad marketing segment.",
        "outline should be a compact writing plan with 2-4 beats. Do not prescribe final wording.",
        "Never put reusable slogans, bilingual catchphrases, forced CTAs, or exact sentence templates into the outline.",
        "Do not write 'While X, Y builds', 'keep building', 'real utility', 'unstoppable infrastructure', 'borderless mediator', or similar promotional framing.",
        "Do not force TRON, stablecoins, Bitcoin, decentralization, or geopolitics into the angle unless the supplied evidence directly supports it.",
        "Prefer a narrow, slightly opinionated observation over a sweeping thesis.",
        "Evidence_items must point back to the supplied source_document_id values only. Prefer omission over invention. If the documents do not support a strong claim, keep the brief narrow and explicit.",
      ].join(" "),
      input_schema_ref: "agent.input.brief-builder@v1",
      output_schema_ref: "agent.output.brief-builder@v1",
      input_schema: {
        type: "object",
        required: ["account_id", "generation_mode", "documents", "persona"],
        properties: {
          account_id: { type: "string", minLength: 1 },
          generation_mode: {
            type: "string",
            enum: ["from_trend", "from_documents", "from_source_scope"],
          },
          topic_hint: { type: "string" },
          angle_hint: { type: "string" },
          audience: { type: "string" },
          trend: {
            type: "object",
            required: ["topic", "category", "score"],
            properties: {
              topic: { type: "string", minLength: 1 },
              category: { type: "string", minLength: 1 },
              score: { type: "number" },
            },
            additionalProperties: false,
          },
          documents: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["source_document_id", "title", "summary", "canonical_url"],
              properties: {
                source_document_id: { type: "string", minLength: 1 },
                title: { type: "string", minLength: 1 },
                summary: { type: "string", minLength: 1 },
                canonical_url: { type: "string", minLength: 1 },
                published_at: { type: "string" },
              },
              additionalProperties: false,
            },
          },
          persona: {
            type: "object",
            required: ["writing_style", "bio", "interests", "personality_traits"],
            properties: {
              writing_style: { type: "string", minLength: 1 },
              bio: { type: "string", minLength: 1 },
              interests: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
              personality_traits: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["topic", "angle", "audience", "outline", "rationale", "evidence_items"],
        properties: {
          topic: { type: "string", minLength: 1 },
          angle: { type: "string", minLength: 1 },
          audience: { type: "string", minLength: 1 },
          outline: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
          evidence_items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["source_document_id", "usage_reason", "key_claims"],
              properties: {
                source_document_id: { type: "string", minLength: 1 },
                usage_reason: { type: "string", minLength: 1 },
                key_claims: {
                  type: "array",
                  minItems: 1,
                  items: { type: "string", minLength: 1 },
                },
                quoted_excerpt: { type: "string" },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
    tool_policy: {
      ref: "agent.tool-policy.brief-builder@v1",
      allowed_tools: ["personas.get_current", "trends.get_topic", "sources.list_account_documents", "sources.get_documents"],
    },
  },
  {
    definition: {
      id: "agent-def-writer",
      code: "writer",
      name: "Writer",
      version: "v1",
      input_schema: {
        type: "object",
        required: ["account_id"],
        properties: {
          account_id: { type: "string", minLength: 1 },
          topic: { type: "string", minLength: 1 },
          trend_id: { type: "string" },
          content_brief_id: { type: "string" },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["topic", "content", "rationale"],
        properties: {
          topic: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    prompt: {
      ref: "agent.prompt.writer@v1",
      system_prompt: "You write native-feeling X posts that match an account persona and current source context. Return only JSON.",
      developer_prompt: [
        "Write one publish-ready draft that sounds like the account owner had a thought and posted it directly, not like a brand recap or AI summary.",
        "Ground the post in the supplied content_brief and evidence_documents, but do not copy source phrasing.",
        "Use the persona samples for rhythm, vocabulary, and level of certainty. Do not copy their exact lines.",
        "Pick one shape only: a sharp observation, a contrarian caveat, a practical warning, or a small prediction. Do not combine all of them.",
        "Preferred structure: one concrete detail, then one implication. It is acceptable to be short, partial, opinionated, or slightly asymmetric if that sounds more human.",
        "Let the post have a little texture: a clipped sentence, a mild hedge, a rhetorical question, or a specific noun is better than a polished slogan.",
        "Do not over-explain the full brief. A real X post can leave context implied.",
        "Avoid template language: no 'While X, Y builds', no generic 'keep building/keep going', no 'real utility', no 'unstoppable infrastructure', no 'borderless/neutral mediator' slogans, and no tacked-on bilingual slogan unless the supplied persona samples consistently do that.",
        "Avoid corporate abstractions and stacked nouns. Name the actual constraint, tradeoff, or market behavior instead.",
        "Do not force TRON, stablecoins, Bitcoin, decentralization, or geopolitical framing into every post unless the brief evidence directly supports that angle.",
        "If the brief itself contains promotional slogans, treat them as bad scaffolding and rewrite the underlying idea in plain account voice.",
        "No hashtags unless the persona samples use them. No emoji unless the persona samples use them. No final motivational CTA unless the persona samples repeatedly do that.",
        "Hard constraint: the post must fit within a single X post after X weighted-length counting, so treat 280 weighted characters as the absolute ceiling and aim for 150-230 weighted characters.",
        "Keep it to a single post, not a thread. Do not produce bilingual mirror text, repeated slogans, or a second paragraph that restates the first in another language.",
      ].join(" "),
      input_schema_ref: "agent.input.writer@v1",
      output_schema_ref: "agent.output.writer@v1",
      input_schema: {
        type: "object",
        required: ["account_id", "generation_mode", "topic", "persona"],
        properties: {
          account_id: { type: "string", minLength: 1 },
          generation_mode: {
            type: "string",
            enum: ["source_backed"],
          },
          topic: { type: "string", minLength: 1 },
          trend: {
            type: "object",
            required: ["topic", "category", "score"],
            properties: {
              topic: { type: "string", minLength: 1 },
              category: { type: "string", minLength: 1 },
              score: { type: "number" },
            },
            additionalProperties: false,
          },
          recent_documents: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "summary", "canonical_url"],
              properties: {
                title: { type: "string", minLength: 1 },
                summary: { type: "string", minLength: 1 },
                canonical_url: { type: "string", minLength: 1 },
                published_at: { type: "string" },
              },
              additionalProperties: false,
            },
          },
          content_brief: {
            type: "object",
            required: ["brief_id", "generation_mode", "topic", "angle", "audience", "outline"],
            properties: {
              brief_id: { type: "string", minLength: 1 },
              generation_mode: {
                type: "string",
                enum: ["from_trend", "from_documents", "from_source_scope"],
              },
              topic: { type: "string", minLength: 1 },
              angle: { type: "string", minLength: 1 },
              audience: { type: "string", minLength: 1 },
              outline: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
          evidence_documents: {
            type: "array",
            items: {
              type: "object",
              required: ["source_document_id", "title", "summary", "canonical_url"],
              properties: {
                source_document_id: { type: "string", minLength: 1 },
                title: { type: "string", minLength: 1 },
                summary: { type: "string", minLength: 1 },
                canonical_url: { type: "string", minLength: 1 },
                published_at: { type: "string" },
              },
              additionalProperties: false,
            },
          },
          persona: {
            type: "object",
            required: [
              "writing_style",
              "bio",
              "interests",
              "personality_traits",
              "distillation_sample_tweets",
            ],
            properties: {
              writing_style: { type: "string", minLength: 1 },
              bio: { type: "string", minLength: 1 },
              interests: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
              personality_traits: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
              distillation_sample_tweets: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["topic", "content", "rationale"],
        properties: {
          topic: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1 },
          rationale: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    tool_policy: {
      ref: "agent.tool-policy.writer@v1",
      allowed_tools: ["personas.get_current", "trends.get_topic", "sources.list_recent_documents", "content_briefs.get", "content_briefs.get_evidence", "drafts.originality_guard"],
    },
  },
  {
    definition: {
      id: "agent-def-reviewer",
      code: "reviewer",
      name: "Reviewer",
      version: "v1",
      input_schema: {
        type: "object",
        required: ["draft_id"],
        properties: {
          draft_id: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["recommendation", "rationale"],
        properties: {
          recommendation: {
            type: "string",
            enum: ["approve", "reject", "request_regenerate"],
          },
          rationale: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    prompt: {
      ref: "agent.prompt.reviewer@v1",
      system_prompt: "You review draft posts for persona alignment and publish readiness. Return only JSON.",
      developer_prompt: "Review the draft content and provide one explicit recommendation with a concise rationale.",
      input_schema_ref: "agent.input.reviewer@v1",
      output_schema_ref: "agent.output.reviewer@v1",
      input_schema: {
        type: "object",
        required: ["draft_id", "topic", "content", "persona"],
        properties: {
          draft_id: { type: "string", minLength: 1 },
          topic: { type: "string", minLength: 1 },
          content: { type: "string", minLength: 1 },
          persona: {
            type: "object",
            required: ["writing_style", "bio", "interests", "personality_traits"],
            properties: {
              writing_style: { type: "string", minLength: 1 },
              bio: { type: "string", minLength: 1 },
              interests: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
              personality_traits: {
                type: "array",
                items: { type: "string", minLength: 1 },
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: ["recommendation", "rationale"],
        properties: {
          recommendation: {
            type: "string",
            enum: ["approve", "reject", "request_regenerate"],
          },
          rationale: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    tool_policy: {
      ref: "agent.tool-policy.reviewer@v1",
      allowed_tools: ["drafts.get_current_version", "personas.get_current"],
    },
  },
  {
    definition: {
      id: "agent-def-persona-distiller",
      code: "persona-distiller",
      name: "Persona Distiller",
      version: "v1",
      input_schema: {
        type: "object",
        required: ["account_id", "samples"],
        properties: {
          account_id: { type: "string", minLength: 1 },
          samples: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["kind", "content"],
              properties: {
                kind: {
                  type: "string",
                  enum: ["post", "reply"],
                },
                content: { type: "string", minLength: 1 },
                canonical_url: { type: "string" },
                created_at: { type: "string" },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: [
          "gender",
          "nationality",
          "age",
          "interests",
          "personality_traits",
          "writing_style",
          "bio",
          "distillation_sample_tweets",
          "reasoning_summary",
        ],
        properties: {
          gender: { type: "string", minLength: 1 },
          nationality: { type: "string", minLength: 1 },
          age: { type: "integer" },
          interests: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          personality_traits: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          writing_style: { type: "string", minLength: 1 },
          bio: { type: "string", minLength: 1 },
          distillation_sample_tweets: { type: "string", minLength: 1 },
          reasoning_summary: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    prompt: {
      ref: "agent.prompt.persona-distiller@v1",
      system_prompt: "You infer a social-media persona from tweet and reply samples. Return only JSON.",
      developer_prompt: "Infer a practical operator-facing persona card from the supplied posts and replies only. Focus on recurring topics, self-positioning, tone, disagreement style, reply behavior, vocabulary, sentence rhythm, and whether the author sounds like a founder, operator, researcher, creator, or commentator. Keep interests and personality_traits concrete and reusable for later generation. writing_style should describe how the person writes, not what they believe. bio should be a short one-line summary of who this person appears to be. If evidence is weak, prefer 'unknown' over invention for gender or nationality. age must be a best-effort estimate between 1 and 120. distillation_sample_tweets must contain 3-8 representative lines copied verbatim from the input, separated by newlines.",
      input_schema_ref: "agent.input.persona-distiller@v1",
      output_schema_ref: "agent.output.persona-distiller@v1",
      input_schema: {
        type: "object",
        required: ["account_id", "samples"],
        properties: {
          account_id: { type: "string", minLength: 1 },
          samples: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["kind", "content"],
              properties: {
                kind: {
                  type: "string",
                  enum: ["post", "reply"],
                },
                content: { type: "string", minLength: 1 },
                canonical_url: { type: "string" },
                created_at: { type: "string" },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      output_schema: {
        type: "object",
        required: [
          "gender",
          "nationality",
          "age",
          "interests",
          "personality_traits",
          "writing_style",
          "bio",
          "distillation_sample_tweets",
          "reasoning_summary",
        ],
        properties: {
          gender: { type: "string", minLength: 1 },
          nationality: { type: "string", minLength: 1 },
          age: { type: "integer" },
          interests: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          personality_traits: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          writing_style: { type: "string", minLength: 1 },
          bio: { type: "string", minLength: 1 },
          distillation_sample_tweets: { type: "string", minLength: 1 },
          reasoning_summary: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    tool_policy: {
      ref: "agent.tool-policy.persona-distiller@v1",
      allowed_tools: ["personas.get_current", "sources.get_distillation_samples"],
    },
  },
];

export function listAgentArtifactBundles(): AgentArtifactBundle[] {
  return AGENT_ARTIFACTS;
}

export function getAgentArtifactBundle(code: string, version: string): AgentArtifactBundle {
  const artifact = AGENT_ARTIFACTS.find((candidate) => candidate.definition.code === code && candidate.definition.version === version);
  if (!artifact) {
    throw new Error(`agent artifact not found for ${code}@${version}`);
  }

  return artifact;
}
