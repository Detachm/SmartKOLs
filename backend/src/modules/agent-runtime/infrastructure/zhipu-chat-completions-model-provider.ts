import { createHmac } from "node:crypto";
import { AppError } from "../../../core/errors/app-error";
import type {
  ModelProvider,
  ModelProviderDescriptor,
  ModelProviderInvocation,
  ModelProviderResult,
} from "../application/ports/model-provider";

export interface ZhipuChatCompletionsModelProviderConfig {
  api_key: string;
  base_url: string;
  model: string;
  review_model?: string;
  request_timeout_ms: number;
  max_output_tokens: number;
  auth_mode: "api_key" | "jwt";
}

interface ZhipuErrorResponse {
  error?: {
    message?: string;
    code?: string;
  };
}

interface ZhipuChatCompletionEnvelope {
  id?: string;
  request_id?: string;
  error?: {
    message?: string;
    code?: string;
  };
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | Array<{ text?: string }>;
      reasoning_content?: string;
    };
    finish_reason?: string;
  }>;
}

export class ZhipuChatCompletionsModelProvider implements ModelProvider {
  constructor(private readonly config: ZhipuChatCompletionsModelProviderConfig) {}

  describe(): ModelProviderDescriptor {
    return {
      provider: "zhipu",
      model_name: this.config.model,
    };
  }

  async invoke(input: ModelProviderInvocation): Promise<ModelProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.request_timeout_ms);
    const selectedModel = this.resolveModel(input.agent_code);

    try {
      const response = await fetch(`${this.config.base_url}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.createAuthorizationToken()}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(input),
            },
            {
              role: "user",
              content: input.user_prompt,
            },
          ],
          response_format: {
            type: "json_object",
          },
          do_sample: false,
          max_tokens: this.config.max_output_tokens,
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();
      if (!response.ok) {
        throw toZhipuHttpError(response.status, rawText);
      }

      const envelope = parseZhipuEnvelope(rawText);
      if (envelope.error) {
        throw new AppError("EXTERNAL_DEPENDENCY_ERROR", envelope.error.message?.trim() || "Zhipu chat completions request failed");
      }

      return {
        provider: "zhipu",
        model_name: selectedModel,
        provider_request_id: envelope.request_id?.trim() || envelope.id?.trim() || undefined,
        raw_text: extractOutputText(envelope, rawText),
        raw_response: rawText,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("MODEL_TIMEOUT", "Zhipu chat completions request timed out", { cause: error });
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private createAuthorizationToken(): string {
    if (this.config.auth_mode === "api_key") {
      return this.config.api_key;
    }

    const [apiKeyId, apiKeySecret] = this.config.api_key.split(".", 2);
    if (!apiKeyId || !apiKeySecret) {
      throw new AppError("INTERNAL_ERROR", "ZHIPU_API_KEY must use the documented id.secret format when ZHIPU_AUTH_MODE=jwt");
    }

    const header = {
      alg: "HS256",
      sign_type: "SIGN",
    };
    const payload = {
      api_key: apiKeyId,
      exp: Date.now() + 60 * 60 * 1000,
      timestamp: Date.now(),
    };
    const unsignedToken = `${toBase64Url(header)}.${toBase64Url(payload)}`;
    const signature = createHmac("sha256", apiKeySecret).update(unsignedToken).digest("base64url");
    return `${unsignedToken}.${signature}`;
  }

  private resolveModel(agentCode: string): string {
    if (agentCode === "reviewer" && this.config.review_model) {
      return this.config.review_model;
    }

    return this.config.model;
  }
}

function buildSystemPrompt(input: ModelProviderInvocation): string {
  return [
    input.system_prompt,
    "Developer instructions:",
    input.developer_prompt,
    `Agent code: ${input.agent_code}`,
    `Prompt artifact: ${input.prompt_artifact_ref}`,
    `Tool policy: ${input.tool_spec_ref}`,
    `Allowed tools: ${input.allowed_tools.join(", ") || "none"}`,
    "Return exactly one JSON object and nothing else.",
    "Do not wrap the JSON in markdown or code fences.",
    "The JSON object must satisfy this schema:",
    JSON.stringify(input.output_schema, null, 2),
  ].join("\n\n");
}

function parseZhipuEnvelope(rawText: string): ZhipuChatCompletionEnvelope {
  try {
    return JSON.parse(rawText) as ZhipuChatCompletionEnvelope;
  } catch (error) {
    throw new AppError("MODEL_INVALID_OUTPUT", "Zhipu returned non-JSON response envelope", {
      cause: error,
      details: { raw_response: rawText },
    });
  }
}

function extractOutputText(envelope: ZhipuChatCompletionEnvelope, rawResponse: string): string {
  const choice = envelope.choices?.[0];
  const message = choice?.message;
  if (!message) {
    throw new AppError("MODEL_INVALID_OUTPUT", "Zhipu response did not contain a completion choice", {
      details: {
        raw_response: rawResponse,
      },
    });
  }

  const content = message.content;
  if (typeof content === "string" && content.trim() !== "") {
    return stripJsonCodeFence(content);
  }

  if (Array.isArray(content)) {
    const text = content
      .map((item) => item?.text?.trim() || "")
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text !== "") {
      return stripJsonCodeFence(text);
    }
  }

  throw new AppError("MODEL_INVALID_OUTPUT", "Zhipu response did not contain assistant text content", {
    details: {
      finish_reason: choice?.finish_reason,
      reasoning_content_present: typeof message.reasoning_content === "string" && message.reasoning_content.trim() !== "",
      raw_response: rawResponse,
    },
  });
}

function stripJsonCodeFence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  return trimmed;
}

function toZhipuHttpError(status: number, rawText: string): AppError {
  const parsed = parseZhipuError(rawText);
  const message = parsed.error?.message?.trim() || `Zhipu chat completions request failed with status ${status}`;

  if (status === 429) {
    return new AppError("MODEL_RATE_LIMITED", message, {
      details: { status, code: parsed.error?.code },
    });
  }

  if (status >= 500) {
    return new AppError("MODEL_UPSTREAM_5XX", message, {
      details: { status, code: parsed.error?.code },
    });
  }

  return new AppError("EXTERNAL_DEPENDENCY_ERROR", message, {
    details: { status, code: parsed.error?.code },
  });
}

function parseZhipuError(rawText: string): ZhipuErrorResponse {
  try {
    return JSON.parse(rawText) as ZhipuErrorResponse;
  } catch {
    return {};
  }
}

function toBase64Url(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
