import fs from "fs";
import path from "path";

const root = process.cwd();

const files = {
  frontend: path.join(root, ".env.local"),
  backendHttp: path.join(root, ".env.backend-http.local"),
  backendWorker: path.join(root, ".env.backend-worker.local"),
  openai: path.join(root, ".env.openai.local"),
  zhipu: path.join(root, ".env.zhipu.local"),
};

const frontendEnv = parseEnvFile(files.frontend);
const backendHttpEnv = parseEnvFile(files.backendHttp);
const backendWorkerEnv = parseEnvFile(files.backendWorker);
const openaiEnv = parseEnvFile(files.openai);
const zhipuEnv = parseEnvFile(files.zhipu);

const failures = [];
const warnings = [];

checkRequired(files.frontend, frontendEnv, [
  "SMARTKOLS_BACKEND_BASE_URL",
], failures);

if (!frontendEnv.NEXT_PUBLIC_SMARTKOLS_X_AUTH_BASE_URL) {
  warnings.push(
    ".env.local is missing NEXT_PUBLIC_SMARTKOLS_X_AUTH_BASE_URL; local frontend will fall back to its own /auth/x routes.",
  );
}

checkRequired(files.backendHttp, backendHttpEnv, [
  "BACKEND_PORT",
  "BACKEND_DB_PATH",
  "BACKEND_ARTIFACTS_DIR",
  "X_OAUTH2_CLIENT_ID",
  "X_OAUTH2_CLIENT_SECRET",
  "X_API_BASE_URL",
  "X_API_REQUEST_TIMEOUT_MS",
  "SOURCE_FETCH_REQUEST_TIMEOUT_MS",
  "SOURCE_FETCH_USER_AGENT",
  "SOURCE_FETCH_MAX_ITEMS",
], failures);

checkRequired(files.backendWorker, backendWorkerEnv, [
  "BACKEND_PORT",
  "BACKEND_DB_PATH",
  "BACKEND_ARTIFACTS_DIR",
  "X_OAUTH2_CLIENT_ID",
  "X_OAUTH2_CLIENT_SECRET",
  "X_API_BASE_URL",
  "X_API_REQUEST_TIMEOUT_MS",
  "SOURCE_FETCH_REQUEST_TIMEOUT_MS",
  "SOURCE_FETCH_USER_AGENT",
  "SOURCE_FETCH_MAX_ITEMS",
  "WORKER_POLL_INTERVAL_MS",
  "WORKER_MAX_JOBS_PER_TICK",
], failures);

const openaiReady = Boolean(openaiEnv.OPENAI_API_KEY?.trim());
const zhipuReady = Boolean(zhipuEnv.ZHIPU_API_KEY?.trim());
const configuredProvider = normalizeProvider(backendWorkerEnv.LLM_PROVIDER || backendHttpEnv.LLM_PROVIDER);
const selectedProvider = resolveProvider(configuredProvider, { openaiReady, zhipuReady });

if (openaiReady && zhipuReady && !configuredProvider) {
  warnings.push("both .env.zhipu.local and .env.openai.local are present; local scripts will prefer zhipu unless LLM_PROVIDER is set explicitly.");
}

console.log("SmartKOLs local doctor");
console.log("");

if (failures.length === 0) {
  console.log("[ready] frontend/backend base config files are present");
} else {
  for (const failure of failures) {
    console.log(`[missing] ${failure}`);
  }
}

if (warnings.length > 0) {
  console.log("");
  for (const warning of warnings) {
    console.log(`[warn] ${warning}`);
  }
}

console.log("");
if (selectedProvider && isProviderReady(selectedProvider, { openaiReady, zhipuReady })) {
  console.log(`[ready] selected LLM provider: ${selectedProvider}`);
  console.log(selectedProvider === "zhipu"
    ? "[ready] .env.zhipu.local contains ZHIPU_API_KEY"
    : "[ready] .env.openai.local contains OPENAI_API_KEY");
  console.log("[ready] full worker set can be started, including agent-worker");
} else if (configuredProvider) {
  console.log(`[pending] LLM_PROVIDER=${configuredProvider} is selected but its local key is missing`);
  console.log(configuredProvider === "zhipu"
    ? "[pending] fill .env.zhipu.local:ZHIPU_API_KEY before starting agent-worker"
    : "[pending] fill .env.openai.local:OPENAI_API_KEY before starting agent-worker");
} else {
  console.log("[pending] no local LLM key is ready yet");
  console.log("[pending] fill .env.zhipu.local:ZHIPU_API_KEY or .env.openai.local:OPENAI_API_KEY before starting agent-worker");
}

console.log("");
console.log("Run order:");
console.log("1. npm run doctor");
console.log("2. npm run backend:dev:local");
console.log("3. npm run backend:worker:local -- publisher-worker");
console.log("4. npm run backend:worker:local -- ingestion-worker");
console.log("5. npm run backend:worker:local -- engagement-worker");
console.log(selectedProvider && isProviderReady(selectedProvider, { openaiReady, zhipuReady })
  ? "6. npm run backend:worker:local -- agent-worker"
  : "6. fill .env.zhipu.local:ZHIPU_API_KEY or .env.openai.local:OPENAI_API_KEY, then run npm run backend:worker:local -- agent-worker");

if (failures.length > 0) {
  process.exitCode = 1;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const record = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    record[key] = stripMatchingQuotes(rawValue.trim());
  }

  return record;
}

function stripMatchingQuotes(value) {
  if (
    value.length >= 2
    && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function checkRequired(filePath, env, keys, failures) {
  if (!fs.existsSync(filePath)) {
    failures.push(`${path.basename(filePath)} does not exist`);
    return;
  }

  for (const key of keys) {
    if (!env[key] || env[key].trim() === "") {
      failures.push(`${path.basename(filePath)} is missing ${key}`);
    }
  }
}

function normalizeProvider(value) {
  if (value === "openai" || value === "zhipu") {
    return value;
  }

  return undefined;
}

function resolveProvider(configuredProvider, readiness) {
  if (configuredProvider) {
    return configuredProvider;
  }
  if (readiness.zhipuReady) {
    return "zhipu";
  }
  if (readiness.openaiReady) {
    return "openai";
  }

  return undefined;
}

function isProviderReady(provider, readiness) {
  return provider === "zhipu" ? readiness.zhipuReady : readiness.openaiReady;
}
