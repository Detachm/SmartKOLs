#!/usr/bin/env node

const baseUrl = process.env.SMARTKOLS_SMOKE_BASE_URL ?? "https://smartkol.vercel.app";
const workspaceSlug = process.env.SMARTKOLS_SMOKE_WORKSPACE_SLUG ?? "test";
const workspaceId = process.env.SMARTKOLS_SMOKE_WORKSPACE_ID ?? "f2d2cfed-d453-45a8-bd9d-341a5ee296b7";
const email = process.env.SMARTKOLS_SMOKE_EMAIL ?? "liuhan010407@gmail.com";
const name = process.env.SMARTKOLS_SMOKE_NAME ?? "Operator";
const expectedHandle = process.env.SMARTKOLS_SMOKE_ACCOUNT_HANDLE ?? "@SFgrxvU6Zf50395";
const strict = process.env.SMARTKOLS_E2E_STRICT === "1";

const failures = [];
const gaps = [];
const passes = [];

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

  return { status: response.status, headers: response.headers, text, body };
}

async function backend(path, cookie, label) {
  const result = await request(path, { headers: { cookie } });
  if (result.status !== 200 || result.body?.ok !== true) {
    fail(label, `expected backend ok 200, got ${result.status}`, result.text);
    return undefined;
  }

  return result.body.data;
}

async function main() {
  const login = await request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, name, workspace_slug: workspaceSlug }),
  });
  if (login.status !== 200 || login.body?.selected_workspace?.id !== workspaceId) {
    fail("session", `expected selected workspace ${workspaceId}, got ${login.status}`, login.text);
    finish();
  }

  const cookie = buildCookieHeader(readSetCookie(login.headers));
  if (!cookie) {
    fail("session.cookie", "login did not set a session cookie", login.text);
    finish();
  }
  pass("session", `workspace ${workspaceSlug}`);

  const accountsData = await backend(`/api/backend/accounts?workspace_id=${encodeURIComponent(workspaceId)}`, cookie, "accounts.list");
  const accounts = accountsData?.accounts ?? [];
  const account = accounts.find((item) => item.handle === expectedHandle);
  if (!account?.id) {
    fail("account", `no account found; expected ${expectedHandle}`, JSON.stringify(accountsData ?? {}, null, 2));
    finish();
  }
  pass("account", `${account.handle} (${account.id})`);

  const accountId = account.id;
  const [
    readiness,
    overview,
    sourcesData,
    documentsData,
    briefWorkbench,
    draftWorkbench,
    engagementWorkbench,
    monitoring,
  ] = await Promise.all([
    backend(`/api/backend/accounts/${accountId}/readiness`, cookie, "accounts.readiness"),
    backend(`/api/backend/accounts/${accountId}/automation-overview`, cookie, "accounts.automation_overview"),
    backend(`/api/backend/accounts/${accountId}/sources`, cookie, "accounts.sources"),
    backend(`/api/backend/accounts/${accountId}/source-documents?limit=10`, cookie, "accounts.source_documents"),
    backend(`/api/backend/accounts/${accountId}/brief-workbench?brief_limit=10&document_limit=10`, cookie, "accounts.brief_workbench"),
    backend(`/api/backend/accounts/${accountId}/draft-workbench?draft_limit=10&brief_limit=10`, cookie, "accounts.draft_workbench"),
    backend(`/api/backend/accounts/${accountId}/engagement-workbench?limit=10`, cookie, "engagement.workbench"),
    backend(`/api/backend/monitoring/overview?workspace_id=${workspaceId}&limit=100`, cookie, "monitoring.overview"),
  ]);

  if (failures.length > 0) {
    finish();
  }

  auditReadiness(readiness);
  auditAutomationOverview(overview);
  auditContentChain({ sourcesData, documentsData, briefWorkbench, draftWorkbench });
  auditEngagementChain({ readiness, overview, engagementWorkbench });
  auditMonitoring(monitoring);

  finish();
}

function auditReadiness(readiness) {
  if (!readiness?.checks || !readiness.runtime) {
    fail("readiness.contract", "readiness response is missing checks/runtime", JSON.stringify(readiness ?? {}, null, 2));
    return;
  }

  pass("readiness.contract", readiness.overall_status);
  if (readiness.overall_status !== "ready") {
    gap("readiness.overall", `account is ${readiness.overall_status}; ready ${readiness.summary?.ready_count ?? "?"}, blocked ${readiness.summary?.blocked_count ?? "?"}, warning ${readiness.summary?.warning_count ?? "?"}`);
  } else {
    pass("readiness.overall", "ready");
  }

  for (const key of ["credential", "profile", "persona", "sources", "autopost", "engagement"]) {
    const status = readiness.checks[key]?.status;
    if (status === "ready") {
      pass(`readiness.${key}`, "ready");
    } else {
      gap(`readiness.${key}`, `${status ?? "missing"}: ${readiness.checks[key]?.message ?? "no message"}`);
    }
  }
}

function auditAutomationOverview(overview) {
  if (!overview?.evaluation?.chosen_action || !overview.engagement_automation) {
    fail("automation.contract", "automation overview missing evaluation or engagement_automation", JSON.stringify(overview ?? {}, null, 2));
    return;
  }

  pass("automation.contract", overview.orchestration_status);
  if (!overview.has_active_automation) {
    gap("automation.active", "account has no active automation policy/state");
  } else {
    pass("automation.active", "active automation present");
  }

  if (overview.orchestration_status !== "active") {
    gap("automation.status", `orchestration status is ${overview.orchestration_status}`);
  } else {
    pass("automation.status", "active");
  }

  if (overview.evaluation.chosen_action.type === "no_action") {
    gap("automation.next_action", `no action: ${overview.evaluation.chosen_action.reason_code}`);
  } else {
    pass("automation.next_action", overview.evaluation.chosen_action.type);
  }

  if (overview.recent_runs.length === 0) {
    gap("automation.recent_runs", "no orchestration run history yet");
  } else {
    pass("automation.recent_runs", `${overview.recent_runs.length} recent runs`);
  }
}

function auditContentChain(input) {
  const sources = input.sourcesData?.sources ?? [];
  const activeSources = sources.filter((source) => source.status === "active");
  const documents = input.documentsData?.documents ?? input.briefWorkbench?.documents ?? [];
  const briefs = input.briefWorkbench?.briefs ?? [];
  const drafts = input.draftWorkbench?.drafts ?? [];

  activeSources.length > 0
    ? pass("content.sources", `${activeSources.length} active sources`)
    : gap("content.sources", "no active sources");

  documents.length > 0
    ? pass("content.documents", `${documents.length} recent source documents`)
    : gap("content.documents", "no source documents; source fetch -> brief evidence cannot be proven");

  briefs.length > 0
    ? pass("content.briefs", `${briefs.length} briefs visible`)
    : gap("content.briefs", "no briefs visible in workbench");

  drafts.length > 0
    ? pass("content.drafts", `${drafts.length} drafts visible`)
    : gap("content.drafts", "no drafts visible in workbench");
}

function auditEngagementChain(input) {
  const engagement = input.overview?.engagement_automation;
  const policy = input.engagementWorkbench?.policy;
  const threads = input.engagementWorkbench?.threads ?? [];
  const proposals = input.engagementWorkbench?.proposals ?? [];

  if (input.readiness?.checks?.engagement?.status === "ready") {
    pass("engagement.readiness", "ready");
  } else {
    gap("engagement.readiness", `${input.readiness?.checks?.engagement?.status ?? "missing"}: ${input.readiness?.checks?.engagement?.message ?? "no message"}`);
  }

  policy
    ? pass("engagement.policy", policy.status)
    : gap("engagement.policy", "no engagement policy configured");

  const openThreadCount = engagement?.open_thread_count ?? threads.length;
  openThreadCount > 0
    ? pass("engagement.threads", `${openThreadCount} open/listed threads`)
    : pass("engagement.threads", "no open threads currently require reply handling");

  const replyBacklogCount = (engagement?.pending_review_reply_count ?? 0) + (engagement?.approved_reply_pending_send_count ?? 0);
  if (openThreadCount > 0 || replyBacklogCount > 0) {
    proposals.length > 0 || replyBacklogCount > 0
      ? pass("engagement.proposals", `${proposals.length} proposals listed; backlog ${replyBacklogCount}`)
      : gap("engagement.proposals", "open threads exist but no reply proposals are visible");
  } else {
    pass("engagement.proposals", "no reply proposals required while there are no open threads");
  }
}

function auditMonitoring(monitoring) {
  if (!monitoring?.summary || !Array.isArray(monitoring.operator_queues)) {
    fail("monitoring.contract", "monitoring overview missing summary/operator_queues", JSON.stringify(monitoring ?? {}, null, 2));
    return;
  }

  pass("monitoring.contract", monitoring.summary.operations_health_status);
  if (monitoring.summary.operations_health_status === "unhealthy") {
    gap("monitoring.health", "operations health is unhealthy");
  } else {
    pass("monitoring.health", monitoring.summary.operations_health_status);
  }

  const operatorBacklogKinds = new Set(["account_readiness", "draft_review", "reply_review"]);
  const operatorBacklogCount = monitoring.operator_queue_summary
    .filter((item) => operatorBacklogKinds.has(item.kind))
    .reduce((sum, item) => sum + item.failed_count, 0);
  const systemFailedCount = monitoring.operator_queue_summary
    .filter((item) => !operatorBacklogKinds.has(item.kind))
    .reduce((sum, item) => sum + item.failed_count, 0);
  const actionableSystemFailedCount = monitoring.operator_queues.filter((item) => {
    if (operatorBacklogKinds.has(item.kind) || item.status !== "failed") {
      return false;
    }

    if (item.error_category) {
      return ["temporary_external_error", "rate_limited", "system_failure"].includes(item.error_category);
    }

    return item.retry_supported === true && item.auto_retry_recommended === true;
  }).length;

  if (operatorBacklogCount > 0) {
    gap("monitoring.operator_backlog", `${operatorBacklogCount} operator backlog items`);
  } else {
    pass("monitoring.operator_backlog", "no operator backlog items");
  }

  if (actionableSystemFailedCount > 0) {
    gap("monitoring.system_failed_queue", `${actionableSystemFailedCount} system failed queue items`);
  } else {
    const operatorRequiredCount = systemFailedCount - actionableSystemFailedCount;
    pass("monitoring.system_failed_queue", operatorRequiredCount > 0
      ? `no actionable system failures; ${operatorRequiredCount} failed items require operator/config fixes`
      : "no system failed queue items");
  }

  const categorized = monitoring.operator_queues.filter((item) => item.error_category || item.error_user_message);
  if (monitoring.operator_queues.length > 0 && categorized.length === 0) {
    gap("monitoring.error_classification", "operator queue has items but none include error classification fields");
  } else {
    pass("monitoring.error_classification", `${categorized.length}/${monitoring.operator_queues.length} queue items classified`);
  }
}

function pass(label, message) {
  passes.push({ label, message });
  console.log(`ok ${label}: ${message}`);
}

function gap(label, message) {
  gaps.push({ label, message });
  console.warn(`gap ${label}: ${message}`);
}

function fail(label, message, body) {
  failures.push({ label, message, body });
  console.error(`fail ${label}: ${message}`);
}

function finish() {
  const scoreTotal = passes.length + gaps.length;
  const score = scoreTotal > 0 ? Math.round((passes.length / scoreTotal) * 100) : 0;

  if (gaps.length > 0) {
    console.warn(`\nautomation e2e gaps: ${gaps.length}`);
    for (const item of gaps) {
      console.warn(`- ${item.label}: ${item.message}`);
    }
  }

  if (failures.length > 0 || (strict && gaps.length > 0)) {
    if (strict && gaps.length > 0) {
      console.error("\nstrict mode treats gaps as failures");
    }
    if (failures.length > 0) {
      console.error(`\nautomation e2e failed: ${failures.length}`);
      for (const failure of failures) {
        console.error(`\n[${failure.label}] ${failure.message}`);
        if (failure.body) {
          console.error(String(failure.body).slice(0, 1200));
        }
      }
    }
    process.exit(1);
  }

  console.log(`\nautomation e2e passed with readiness score ${score}%: ${baseUrl} -> ${workspaceSlug}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
