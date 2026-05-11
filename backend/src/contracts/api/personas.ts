import type { Persona } from "../../modules/personas/domain/persona";

export interface PersonaResponse {
  persona: Persona;
}

export interface PersonaDistillationSample {
  kind?: "post" | "reply";
  content: string;
  canonical_url?: string;
  created_at?: string;
}

export interface DistillPersonaRequest {
  samples?: PersonaDistillationSample[];
  twitter_handle?: string;
  source_ids?: string[];
  max_samples?: number;
}

export interface DistillPersonaResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}
