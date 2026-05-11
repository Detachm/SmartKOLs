import { AppError } from "../../../core/errors/app-error";
import { requireIntegerInRange, requireNonEmptyString } from "../../../core/validation/guards";

export interface PersonaTemplateProfile {
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
}

export interface PersonaTemplate {
  id: string;
  workspace_id?: string;
  name: string;
  description: string;
  persona: PersonaTemplateProfile;
  is_active: boolean;
  created_at: string;
}

function normalizeTags(values: string[], field: string): string[] {
  if (!Array.isArray(values)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be an array`, {
      details: { field },
    });
  }

  return values
    .map((value) => requireNonEmptyString(value, field))
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function createPersonaTemplateProfile(input: PersonaTemplateProfile): PersonaTemplateProfile {
  return {
    gender: requireNonEmptyString(input.gender, "persona.gender"),
    nationality: requireNonEmptyString(input.nationality, "persona.nationality"),
    age: requireIntegerInRange(input.age, "persona.age", 1, 120),
    interests: normalizeTags(input.interests, "persona.interests"),
    personality_traits: normalizeTags(input.personality_traits, "persona.personality_traits"),
    writing_style: requireNonEmptyString(input.writing_style, "persona.writing_style"),
    bio: input.bio.trim(),
    distillation_sample_tweets: input.distillation_sample_tweets.trim(),
  };
}

export function parsePersonaTemplateBody(templateBody: string): PersonaTemplateProfile {
  const parsed = JSON.parse(requireNonEmptyString(templateBody, "template_body")) as PersonaTemplateProfile;
  return createPersonaTemplateProfile(parsed);
}

export function serializePersonaTemplateBody(persona: PersonaTemplateProfile): string {
  return JSON.stringify(createPersonaTemplateProfile(persona));
}

export function createPersonaTemplate(template: PersonaTemplate): PersonaTemplate {
  return {
    id: requireNonEmptyString(template.id, "id"),
    workspace_id: template.workspace_id?.trim() || undefined,
    name: requireNonEmptyString(template.name, "name"),
    description: requireNonEmptyString(template.description, "description"),
    persona: createPersonaTemplateProfile(template.persona),
    is_active: Boolean(template.is_active),
    created_at: requireNonEmptyString(template.created_at, "created_at"),
  };
}
