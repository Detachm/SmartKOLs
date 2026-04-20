export interface PersonaTemplateProfileResponse {
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
}

export interface PersonaTemplateResponse {
  id: string;
  workspace_id?: string;
  scope: "global" | "workspace";
  name: string;
  description: string;
  persona: PersonaTemplateProfileResponse;
  is_active: boolean;
  created_at: string;
}

export interface PersonaTemplateListResponse {
  templates: PersonaTemplateResponse[];
}

export interface CreatePersonaTemplateRequest {
  workspace_id: string;
  name: string;
  description: string;
  persona: PersonaTemplateProfileResponse;
}

export interface ApplyPersonaTemplateRequest {
  account_ids: string[];
  actor_id?: string;
}

export interface ApplyPersonaTemplateResponse {
  template_id: string;
  workspace_id: string;
  applied_count: number;
}
