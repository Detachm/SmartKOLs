export interface InboxClassificationResult {
  classification: "collab" | "commerce" | "spam" | "normal" | "support";
  reasoning_summary: string;
  raw_response: string;
  provider_request_id?: string;
}

export interface ReplyProposalResult {
  content: string;
  rationale: string;
  raw_response: string;
  provider_request_id?: string;
}

export interface DraftGenerationResult {
  topic: string;
  content: string;
  rationale: string;
  raw_response: string;
  provider_request_id?: string;
}

export interface ContentBriefGenerationResult {
  topic: string;
  angle: string;
  audience: string;
  outline: string;
  rationale: string;
  evidence_items: Array<{
    source_document_id: string;
    usage_reason: string;
    key_claims: string[];
    quoted_excerpt?: string;
  }>;
  raw_response: string;
  provider_request_id?: string;
}

export interface DraftReviewResult {
  recommendation: "approve" | "reject" | "request_regenerate";
  rationale: string;
  raw_response: string;
  provider_request_id?: string;
}

export interface PersonaDistillationResult {
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
  reasoning_summary: string;
  raw_response: string;
  provider_request_id?: string;
}

export interface ModelGateway {
  describe(): {
    provider: string;
    model_name: string;
  };

  classifyInboxThread(input: {
    thread_id: string;
    channel: "mention" | "reply" | "dm" | "comment";
    messages: Array<{ sender_handle?: string; content: string; created_at: string }>;
  }, options: { agent_version: string }): Promise<InboxClassificationResult>;

  proposeReply(input: {
    thread_id: string;
    channel: "mention" | "reply" | "dm" | "comment";
    counterpart_handle?: string;
    messages: Array<{ sender_handle?: string; content: string; created_at: string }>;
  }, options: { agent_version: string }): Promise<ReplyProposalResult>;

  generateDraft(input: {
    account_id: string;
    generation_mode: "manual_topic" | "source_backed";
    topic: string;
    trend?: {
      topic: string;
      category: string;
      score: number;
    };
    recent_documents: Array<{
      title: string;
      summary: string;
      canonical_url: string;
      published_at?: string;
    }>;
    evidence_documents?: Array<{
      source_document_id: string;
      title: string;
      summary: string;
      canonical_url: string;
      published_at?: string;
    }>;
    content_brief?: {
      brief_id: string;
      generation_mode: "from_trend" | "from_documents" | "from_source_scope";
      topic: string;
      angle: string;
      audience: string;
      outline: string;
    };
    persona: {
      writing_style: string;
      bio: string;
      interests: string[];
      personality_traits: string[];
      distillation_sample_tweets: string;
    };
  }, options: { agent_version: string }): Promise<DraftGenerationResult>;

  generateContentBrief(input: {
    account_id: string;
    generation_mode: "from_trend" | "from_documents" | "from_source_scope";
    topic_hint?: string;
    angle_hint?: string;
    audience?: string;
    trend?: {
      topic: string;
      category: string;
      score: number;
    };
    documents: Array<{
      source_document_id: string;
      title: string;
      summary: string;
      canonical_url: string;
      published_at?: string;
    }>;
    persona: {
      writing_style: string;
      bio: string;
      interests: string[];
      personality_traits: string[];
    };
  }, options: { agent_version: string }): Promise<ContentBriefGenerationResult>;

  reviewDraft(input: {
    draft_id: string;
    topic: string;
    content: string;
    persona: {
      writing_style: string;
      bio: string;
      interests: string[];
      personality_traits: string[];
    };
  }, options: { agent_version: string }): Promise<DraftReviewResult>;

  distillPersona(input: {
    account_id: string;
    samples: Array<{
      kind: "post" | "reply";
      content: string;
      canonical_url?: string;
      created_at?: string;
    }>;
  }, options: { agent_version: string }): Promise<PersonaDistillationResult>;
}
