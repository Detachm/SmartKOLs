import type { JsonSchema } from "../../../../core/validation/json-schema";

export interface ModelProviderDescriptor {
  provider: string;
  model_name: string;
}

export interface ModelProviderInvocation {
  agent_code: string;
  prompt_artifact_ref: string;
  tool_spec_ref: string;
  input_schema_ref: string;
  output_schema_ref: string;
  system_prompt: string;
  developer_prompt: string;
  user_prompt: string;
  allowed_tools: string[];
  output_schema: JsonSchema;
}

export interface ModelProviderResult {
  provider: string;
  model_name: string;
  provider_request_id?: string;
  raw_text: string;
  raw_response?: string;
}

export interface ModelProvider {
  describe(): ModelProviderDescriptor;
  invoke(input: ModelProviderInvocation): Promise<ModelProviderResult>;
}
