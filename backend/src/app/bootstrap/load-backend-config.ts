import { AppError } from "../../core/errors/app-error";

export interface BackendConfig {
  port: number;
  host?: string;
  db_path: string;
  security: {
    proxy_shared_secret?: string;
    local_auth_enabled: boolean;
  };
  artifacts: {
    root_dir: string;
  };
  connector_x: {
    api_key?: string;
    api_secret?: string;
    oauth2_client_id: string;
    oauth2_client_secret: string;
    base_url: string;
    request_timeout_ms: number;
  };
  llm:
    | {
        enabled: false;
      }
      | {
          enabled: true;
          provider: "openai";
          api_key: string;
          base_url: string;
          model: string;
          review_model?: string;
          request_timeout_ms: number;
          reasoning_effort?: "low" | "medium" | "high" | "xhigh";
          store?: boolean;
        }
      | {
          enabled: true;
          provider: "zhipu";
          api_key: string;
          base_url: string;
          model: string;
          review_model?: string;
          request_timeout_ms: number;
          max_output_tokens: number;
          auth_mode: "api_key" | "jwt";
        };
  source_fetch: {
    request_timeout_ms: number;
    user_agent: string;
    max_items: number;
  };
}

const DEFAULT_DEV_PROXY_SHARED_SECRET = "smartkols-dev-proxy-secret";

export function loadBackendConfigFromEnv(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const llmEnabled = requireBooleanEnv(env, "LLM_ENABLED");
  const proxySharedSecret = resolveProxySharedSecret(env);
  if ((env.NODE_ENV ?? "").trim() === "production" && !proxySharedSecret) {
    throw new AppError("INTERNAL_ERROR", "BACKEND_PROXY_SHARED_SECRET is required in production", {
      details: { env: "BACKEND_PROXY_SHARED_SECRET" },
    });
  }

  return {
    port: requirePositiveInteger(env.BACKEND_PORT, "BACKEND_PORT"),
    host: optionalNonEmptyEnv(env.BACKEND_HOST),
    db_path: requireNonEmptyEnv(env.BACKEND_DB_PATH, "BACKEND_DB_PATH"),
    security: {
      proxy_shared_secret: proxySharedSecret,
      local_auth_enabled: optionalBooleanEnv(env, "LOCAL_AUTH_ENABLED") ?? ((env.NODE_ENV ?? "").trim() !== "production"),
    },
    artifacts: {
      root_dir: requireNonEmptyEnv(env.BACKEND_ARTIFACTS_DIR, "BACKEND_ARTIFACTS_DIR"),
    },
    connector_x: {
      api_key: optionalNonEmptyEnv(env.X_API_KEY),
      api_secret: optionalNonEmptyEnv(env.X_API_SECRET),
      oauth2_client_id: requireNonEmptyEnv(env.X_OAUTH2_CLIENT_ID, "X_OAUTH2_CLIENT_ID"),
      oauth2_client_secret: requireNonEmptyEnv(env.X_OAUTH2_CLIENT_SECRET, "X_OAUTH2_CLIENT_SECRET"),
      base_url: requireHttpUrl(env.X_API_BASE_URL, "X_API_BASE_URL"),
      request_timeout_ms: requirePositiveInteger(env.X_API_REQUEST_TIMEOUT_MS, "X_API_REQUEST_TIMEOUT_MS"),
    },
    llm: loadLlmConfig(env, llmEnabled),
    source_fetch: {
      request_timeout_ms: requirePositiveInteger(env.SOURCE_FETCH_REQUEST_TIMEOUT_MS, "SOURCE_FETCH_REQUEST_TIMEOUT_MS"),
      user_agent: requireNonEmptyEnv(env.SOURCE_FETCH_USER_AGENT, "SOURCE_FETCH_USER_AGENT"),
      max_items: requirePositiveInteger(env.SOURCE_FETCH_MAX_ITEMS, "SOURCE_FETCH_MAX_ITEMS"),
    },
  };
}

function resolveProxySharedSecret(env: NodeJS.ProcessEnv): string | undefined {
  const configured = optionalNonEmptyEnv(env.BACKEND_PROXY_SHARED_SECRET);
  if (configured) {
    return configured;
  }

  if ((env.NODE_ENV ?? "").trim() !== "production") {
    return DEFAULT_DEV_PROXY_SHARED_SECRET;
  }

  return undefined;
}

function loadLlmConfig(env: NodeJS.ProcessEnv, enabled: boolean): BackendConfig["llm"] {
  if (!enabled) {
    return {
      enabled: false,
    };
  }

  const provider = requireOneOfEnv(env.LLM_PROVIDER, "LLM_PROVIDER", ["openai", "zhipu"] as const);
  switch (provider) {
    case "openai":
      return {
        enabled: true,
        provider,
        api_key: requireNonEmptyEnv(env.OPENAI_API_KEY, "OPENAI_API_KEY"),
        base_url: requireHttpUrl(env.OPENAI_BASE_URL, "OPENAI_BASE_URL"),
        model: requireNonEmptyEnv(env.OPENAI_MODEL, "OPENAI_MODEL"),
        review_model: optionalNonEmptyEnv(env.OPENAI_REVIEW_MODEL),
        request_timeout_ms: requirePositiveInteger(env.OPENAI_REQUEST_TIMEOUT_MS, "OPENAI_REQUEST_TIMEOUT_MS"),
        reasoning_effort: optionalOneOfEnv(
          env.OPENAI_REASONING_EFFORT,
          "OPENAI_REASONING_EFFORT",
          ["low", "medium", "high", "xhigh"] as const,
        ),
        store: optionalBooleanEnv(env, "OPENAI_STORE"),
      };
    case "zhipu":
      return {
        enabled: true,
        provider,
        api_key: requireNonEmptyEnv(env.ZHIPU_API_KEY, "ZHIPU_API_KEY"),
        base_url: requireHttpUrl(env.ZHIPU_BASE_URL, "ZHIPU_BASE_URL"),
        model: requireNonEmptyEnv(env.ZHIPU_MODEL, "ZHIPU_MODEL"),
        review_model: optionalNonEmptyEnv(env.ZHIPU_REVIEW_MODEL),
        request_timeout_ms: requirePositiveInteger(env.ZHIPU_REQUEST_TIMEOUT_MS, "ZHIPU_REQUEST_TIMEOUT_MS"),
        max_output_tokens: optionalPositiveIntegerEnv(env.ZHIPU_MAX_OUTPUT_TOKENS, "ZHIPU_MAX_OUTPUT_TOKENS") ?? 4096,
        auth_mode: optionalOneOfEnv(env.ZHIPU_AUTH_MODE, "ZHIPU_AUTH_MODE", ["api_key", "jwt"] as const) ?? "jwt",
      };
  }
}

export interface WorkerProcessConfig extends BackendConfig {
  worker: {
    name: "all" | "agent-worker" | "publisher-worker" | "ingestion-worker" | "engagement-worker" | "editorial-worker";
    poll_interval_ms: number;
    max_jobs_per_tick: number;
  };
}

export function loadWorkerProcessConfigFromEnv(env: NodeJS.ProcessEnv = process.env): WorkerProcessConfig {
  const base = loadBackendConfigFromEnv(env);
  return {
    ...base,
    worker: {
      name: requireOneOfEnv(
        env.WORKER_NAME,
        "WORKER_NAME",
        ["all", "agent-worker", "publisher-worker", "ingestion-worker", "engagement-worker", "editorial-worker"] as const,
      ),
      poll_interval_ms: requirePositiveInteger(env.WORKER_POLL_INTERVAL_MS, "WORKER_POLL_INTERVAL_MS"),
      max_jobs_per_tick: requirePositiveInteger(env.WORKER_MAX_JOBS_PER_TICK, "WORKER_MAX_JOBS_PER_TICK"),
    },
  };
}

function requireNonEmptyEnv(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") {
    throw new AppError("INTERNAL_ERROR", `${name} is required`, {
      details: { env: name },
    });
  }

  return value.trim();
}

function requirePositiveInteger(value: string | undefined, name: string): number {
  const text = requireNonEmptyEnv(value, name);
  const parsed = Number(text);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError("INTERNAL_ERROR", `${name} must be a positive integer`, {
      details: { env: name, value: text },
    });
  }

  return parsed;
}

function requireBooleanEnv(env: NodeJS.ProcessEnv, name: string): boolean {
  const text = requireNonEmptyEnv(env[name], name).toLowerCase();
  if (text === "true") {
    return true;
  }
  if (text === "false") {
    return false;
  }

  throw new AppError("INTERNAL_ERROR", `${name} must be true or false`, {
    details: { env: name, value: text },
  });
}

function optionalBooleanEnv(env: NodeJS.ProcessEnv, name: string): boolean | undefined {
  const value = env[name];
  if (!value || value.trim() === "") {
    return undefined;
  }

  return requireBooleanEnv(env, name);
}

function optionalPositiveIntegerEnv(value: string | undefined, name: string): number | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  return requirePositiveInteger(value, name);
}

function optionalNonEmptyEnv(value: string | undefined): string | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

function requireHttpUrl(value: string | undefined, name: string): string {
  const text = requireNonEmptyEnv(value, name);
  let url: URL;

  try {
    url = new URL(text);
  } catch (error) {
    throw new AppError("INTERNAL_ERROR", `${name} must be a valid URL`, {
      details: { env: name, value: text },
      cause: error,
    });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError("INTERNAL_ERROR", `${name} must use http or https`, {
      details: { env: name, value: text },
    });
  }

  return url.toString().replace(/\/$/, "");
}

function requireOneOfEnv<T extends string>(
  value: string | undefined,
  name: string,
  choices: readonly T[],
): T {
  const text = requireNonEmptyEnv(value, name);
  if (!choices.includes(text as T)) {
    throw new AppError("INTERNAL_ERROR", `${name} must be one of: ${choices.join(", ")}`, {
      details: { env: name, value: text, choices },
    });
  }

  return text as T;
}

function optionalOneOfEnv<T extends string>(
  value: string | undefined,
  name: string,
  choices: readonly T[],
): T | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  return requireOneOfEnv(value, name, choices);
}
