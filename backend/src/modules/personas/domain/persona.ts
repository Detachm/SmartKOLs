import { AppError } from "../../../core/errors/app-error";
import { requireIntegerInRange, requireNonEmptyString, requireOneOf } from "../../../core/validation/guards";

export type PersonaSource = "manual" | "template" | "distilled" | "generated";
export type PersonaActorType = "user" | "agent" | "system";

export interface Persona {
  id: string;
  workspace_id: string;
  account_id: string;
  version: number;
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
  source: PersonaSource;
  created_by_type: PersonaActorType;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdatePersonaInput {
  workspace_id: string;
  account_id: string;
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
  source: PersonaSource;
  actor_type: PersonaActorType;
  actor_id?: string;
}

function normalizeTags(values: string[], field: string): string[] {
  if (!Array.isArray(values)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be an array`, {
      details: { field },
    });
  }

  const normalized = values
    .map((value) => requireNonEmptyString(value, field))
    .filter((value, index, array) => array.indexOf(value) === index);

  return normalized;
}

export function createOrUpdatePersona(params: {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
  input: UpdatePersonaInput;
}): Persona {
  const source = requireOneOf(params.input.source, "source", ["manual", "template", "distilled", "generated"] as const);
  const actorType = requireOneOf(params.input.actor_type, "actor_type", ["user", "agent", "system"] as const);

  return {
    id: requireNonEmptyString(params.id, "id"),
    workspace_id: requireNonEmptyString(params.input.workspace_id, "workspace_id"),
    account_id: requireNonEmptyString(params.input.account_id, "account_id"),
    version: requireIntegerInRange(params.version, "version", 1, Number.MAX_SAFE_INTEGER),
    gender: requireNonEmptyString(params.input.gender, "gender"),
    nationality: requireNonEmptyString(params.input.nationality, "nationality"),
    age: requireIntegerInRange(params.input.age, "age", 1, 120),
    interests: normalizeTags(params.input.interests, "interests"),
    personality_traits: normalizeTags(params.input.personality_traits, "personality_traits"),
    writing_style: requireNonEmptyString(params.input.writing_style, "writing_style"),
    bio: params.input.bio.trim(),
    distillation_sample_tweets: params.input.distillation_sample_tweets.trim(),
    source,
    created_by_type: actorType,
    created_by_id: params.input.actor_id?.trim() || undefined,
    created_at: requireNonEmptyString(params.created_at, "created_at"),
    updated_at: requireNonEmptyString(params.updated_at, "updated_at"),
  };
}
