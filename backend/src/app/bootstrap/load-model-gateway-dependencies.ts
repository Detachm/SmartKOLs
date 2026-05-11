import type { BackendConfig } from "./load-backend-config";
import { ProviderBackedModelGateway } from "../../modules/agent-runtime/infrastructure/provider-backed-model-gateway";
import { OpenAIResponsesModelProvider } from "../../modules/agent-runtime/infrastructure/openai-responses-model-provider";
import { NotConfiguredModelGateway } from "../../modules/agent-runtime/infrastructure/not-configured-model-gateway";
import { ZhipuChatCompletionsModelProvider } from "../../modules/agent-runtime/infrastructure/zhipu-chat-completions-model-provider";

export function loadModelGatewayDependencies(config: BackendConfig["llm"]) {
  if (!config.enabled) {
    return {
      modelGateway: new NotConfiguredModelGateway(),
    };
  }

  if (config.provider === "openai") {
    return {
      modelGateway: new ProviderBackedModelGateway(new OpenAIResponsesModelProvider({
        api_key: config.api_key,
        base_url: config.base_url,
        model: config.model,
        review_model: config.review_model,
        request_timeout_ms: config.request_timeout_ms,
        reasoning_effort: config.reasoning_effort,
        store: config.store,
      })),
    };
  }

  return {
    modelGateway: new ProviderBackedModelGateway(new ZhipuChatCompletionsModelProvider({
      api_key: config.api_key,
      base_url: config.base_url,
      model: config.model,
      review_model: config.review_model,
      request_timeout_ms: config.request_timeout_ms,
      max_output_tokens: config.max_output_tokens,
      auth_mode: config.auth_mode,
    })),
  };
}
