import { requireNonEmptyString } from "../../../core/validation/guards";

export interface AgentDefinition {
  id: string;
  code: string;
  name: string;
  version: string;
  input_schema: string;
  output_schema: string;
  tool_policy: string;
  is_active: boolean;
}

export function createAgentDefinition(input: AgentDefinition): AgentDefinition {
  return {
    id: requireNonEmptyString(input.id, "id"),
    code: requireNonEmptyString(input.code, "code"),
    name: requireNonEmptyString(input.name, "name"),
    version: requireNonEmptyString(input.version, "version"),
    input_schema: requireNonEmptyString(input.input_schema, "input_schema"),
    output_schema: requireNonEmptyString(input.output_schema, "output_schema"),
    tool_policy: requireNonEmptyString(input.tool_policy, "tool_policy"),
    is_active: Boolean(input.is_active),
  };
}
