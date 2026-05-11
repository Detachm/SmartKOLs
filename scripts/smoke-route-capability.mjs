#!/usr/bin/env node

const baseUrl = process.env.SMARTKOLS_SMOKE_BASE_URL ?? "https://smartkol.vercel.app";
const workspaceSlug = process.env.SMARTKOLS_SMOKE_WORKSPACE_SLUG ?? "test";
const workspaceId = process.env.SMARTKOLS_SMOKE_WORKSPACE_ID ?? "f2d2cfed-d453-45a8-bd9d-341a5ee296b7";
const email = process.env.SMARTKOLS_SMOKE_EMAIL ?? "liuhan010407@gmail.com";
const name = process.env.SMARTKOLS_SMOKE_NAME ?? "Operator";
const expectedHandle = process.env.SMARTKOLS_SMOKE_ACCOUNT_HANDLE ?? "@SFgrxvU6Zf50395";

const failures = [];
const warnings = [];

function endpoint(path) {
  return new URL(path, baseUrl).toString();
}

function readSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

function buildCookieHeader(setCookies) {
  return setCookies
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function request(path, options = {}) {
  const response = await fetch(endpoint(path), {
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  return {
    status: response.status,
    headers: response.headers,
    text,
    body,
  };
}

async function main() {
  const login = await request("/api/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      name,
      workspace_slug: workspaceSlug,
    }),
  });

  if (login.status !== 200 || !login.body?.selected_workspace?.id) {
    fail("session", `expected 200 with selected workspace, got ${login.status}`, login.text);
    finish();
  }

  const cookie = buildCookieHeader(readSetCookie(login.headers));
  if (!cookie) {
    fail("session", "login did not set a session cookie", login.text);
    finish();
  }

  const accountList = await check({
    label: "accounts.list",
    path: `/api/backend/accounts?workspace_id=${encodeURIComponent(workspaceId)}`,
    cookie,
    expectOk: true,
  });
  const accounts = accountList?.body?.data?.accounts ?? [];
  const account = accounts.find((item) => item.handle === expectedHandle);
  if (!account?.id) {
    fail("accounts.list", `no account found; expected ${expectedHandle}`, accountList?.text ?? "");
    finish();
  }

  const accountId = account.id;
  const checks = [
    { label: "workspaces.list", path: "/api/backend/workspaces", expectOk: true },
    { label: "workspace.settings", path: `/api/backend/workspaces/${workspaceId}/settings`, expectOk: true },
    { label: "accounts.control_plane", path: "/api/backend/accounts/control-plane", expectOk: true },
    { label: "account_groups.list", path: `/api/backend/account-groups?workspace_id=${workspaceId}`, expectOk: true },
    { label: "accounts.surface", path: `/api/backend/accounts/${accountId}/surface`, expectOk: true },
    { label: "accounts.automation_overview", path: `/api/backend/accounts/${accountId}/automation-overview`, expectOk: true },
    { label: "accounts.readiness", path: `/api/backend/accounts/${accountId}/readiness`, expectOk: true },
    { label: "accounts.sources", path: `/api/backend/accounts/${accountId}/sources`, expectOk: true },
    { label: "accounts.source_documents", path: `/api/backend/accounts/${accountId}/source-documents?limit=5`, expectOk: true },
    { label: "accounts.brief_workbench", path: `/api/backend/accounts/${accountId}/brief-workbench?brief_limit=5&document_limit=5`, expectOk: true },
    { label: "accounts.draft_workbench", path: `/api/backend/accounts/${accountId}/draft-workbench?draft_limit=5&brief_limit=5`, expectOk: true },
    { label: "accounts.analytics", path: `/api/backend/accounts/${accountId}/analytics?window_days=30`, expectOk: true },
    { label: "personas.detail", path: `/api/backend/personas/${accountId}`, allowNotFound: true },
    { label: "autopost.policy", path: `/api/backend/autopost-policies/${accountId}`, allowNotFound: true },
    { label: "autopost.runs", path: `/api/backend/autopost-policies/${accountId}/runs?limit=5`, expectOk: true },
    { label: "engagement.policy", path: `/api/backend/engagement-policies/${accountId}`, allowNotFound: true },
    { label: "engagement.workbench", path: `/api/backend/accounts/${accountId}/engagement-workbench?limit=5`, expectOk: true },
    { label: "engagement.threads", path: `/api/backend/accounts/${accountId}/engagement-threads?limit=5`, expectOk: true },
    { label: "connector_requests.list", path: `/api/backend/connector-requests?workspace_id=${workspaceId}&account_id=${accountId}&limit=5`, expectOk: true },
    { label: "drafts.list", path: `/api/backend/drafts?workspace_id=${workspaceId}&limit=5`, expectOk: true },
    { label: "schedules.range", path: `/api/backend/schedules?workspace_id=${workspaceId}&from=${encodeURIComponent(new Date(Date.now() - 7 * 86400_000).toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 14 * 86400_000).toISOString())}`, expectOk: true },
    { label: "notifications.list", path: `/api/backend/notifications?workspace_id=${workspaceId}&limit=5`, expectOk: true },
    { label: "monitoring.overview", path: `/api/backend/monitoring/overview?workspace_id=${workspaceId}&limit=5`, expectOk: true },
    { label: "dashboard.overview", path: `/api/backend/dashboard/overview?workspace_id=${workspaceId}`, expectOk: true },
    { label: "app_chrome.overview", path: `/api/backend/app-chrome/overview?workspace_id=${workspaceId}`, expectOk: true },
    { label: "app_chrome.search", path: `/api/backend/app-chrome/search?workspace_id=${workspaceId}&q=account&limit=5`, expectOk: true },
    { label: "trends.list", path: `/api/backend/trends?workspace_id=${workspaceId}`, expectOk: true },
    { label: "alert_channels.list", path: `/api/backend/alert-channels?workspace_id=${workspaceId}&limit=5`, expectOk: true },
  ];

  for (const item of checks) {
    await check({ ...item, cookie });
  }

  finish();
}

async function check(input) {
  const result = await request(input.path, {
    headers: {
      cookie: input.cookie,
    },
  });

  const errorCode = result.body?.error?.code;
  const errorMessage = result.body?.error?.message;
  const isRouteNotFound = result.status === 404 && errorCode === "NOT_FOUND" && errorMessage === "route not found";
  const acceptedNotFound = input.allowNotFound && result.status === 404 && !isRouteNotFound;
  const acceptedOk = input.expectOk ? result.status === 200 && result.body?.ok === true : result.status >= 200 && result.status < 300;

  if (acceptedOk || acceptedNotFound) {
    console.log(`ok ${input.label} ${result.status}`);
    return result;
  }

  const message = `${input.label} expected ${input.allowNotFound ? "200 or entity 404" : "200"}, got ${result.status}${isRouteNotFound ? " (route not found)" : ""}`;
  if (input.optional) {
    warnings.push(message);
    console.warn(`warn ${message}`);
    return result;
  }

  fail(input.label, message, result.text);
  return result;
}

function fail(label, message, body) {
  failures.push({ label, message, body });
  console.error(`fail ${message}`);
}

function finish() {
  if (warnings.length > 0) {
    console.warn(`route capability warnings: ${warnings.length}`);
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error(`route capability failed: ${failures.length}`);
    for (const failure of failures) {
      console.error(`\n[${failure.label}] ${failure.message}`);
      if (failure.body) {
        console.error(failure.body.slice(0, 1000));
      }
    }
    process.exit(1);
  }

  console.log(`route capability passed: ${baseUrl} -> ${workspaceSlug}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
