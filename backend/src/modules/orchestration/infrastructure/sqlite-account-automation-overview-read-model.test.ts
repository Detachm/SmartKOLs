import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { createSqliteRuntime } from "../../../infrastructure/db/sqlite-runtime";
import { SqliteAccountAutomationOverviewReadModel } from "./sqlite-account-automation-overview-read-model";

test("SqliteAccountAutomationOverviewReadModel prefers classify before reply generation and does not re-classify succeeded threads", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smartkols-orch-"));
  const dbPath = path.join(tempDir, "test.sqlite");
  const runtime = createSqliteRuntime(dbPath);

  try {
    runtime.db.run(
      `INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["ws_1", "Workspace", "workspace", "active", "2026-04-19T10:00:00.000Z", "2026-04-19T10:00:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO accounts (
         id, workspace_id, platform, handle, display_name, status,
         follower_count, following_count, post_count, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["acct_1", "ws_1", "x", "@acct", "Acct", "active", 0, 0, 0, "2026-04-19T10:00:00.000Z", "2026-04-19T10:00:00.000Z"],
    );

    runtime.db.run(
      `INSERT INTO engagement_policies (
         id, workspace_id, account_id, policy_body, status, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "policy_1",
        "ws_1",
        "acct_1",
        JSON.stringify({
          allowed_channels: ["mention", "dm"],
          blocked_classifications: ["commerce"],
          require_manual_approval: true,
        }),
        "active",
        "2026-04-19T10:00:00.000Z",
      ],
    );

    runtime.db.run(
      `INSERT INTO engagement_threads (
         id, workspace_id, account_id, channel, external_thread_id, classification, status, last_message_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["thread_classified", "ws_1", "acct_1", "mention", "ext_1", "normal", "open", "2026-04-19T10:10:00.000Z", "2026-04-19T10:10:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO engagement_threads (
         id, workspace_id, account_id, channel, external_thread_id, classification, status, last_message_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["thread_new", "ws_1", "acct_1", "dm", "ext_2", "normal", "open", "2026-04-19T10:20:00.000Z", "2026-04-19T10:20:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO engagement_threads (
         id, workspace_id, account_id, channel, external_thread_id, classification, status, last_message_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["thread_blocked_channel", "ws_1", "acct_1", "comment", "ext_3", "normal", "open", "2026-04-19T10:30:00.000Z", "2026-04-19T10:30:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO engagement_threads (
         id, workspace_id, account_id, channel, external_thread_id, classification, status, last_message_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["thread_blocked_classification", "ws_1", "acct_1", "mention", "ext_4", "commerce", "open", "2026-04-19T10:25:00.000Z", "2026-04-19T10:25:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO agent_definitions (id, code, name, version, input_schema, output_schema, tool_policy, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "agent_def_1",
        "inbox-classifier",
        "Inbox Classifier",
        "v1",
        "{}",
        "{}",
        JSON.stringify({ ref: "test", tools: [] }),
        1,
      ],
    );
    runtime.db.run(
      `INSERT INTO agent_tasks (
         id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status, created_at, started_at, finished_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "classify_task_1",
        "ws_1",
        "agent_def_1",
        "inbox.classify",
        "engagement_thread",
        "thread_classified",
        JSON.stringify({ thread_id: "thread_classified", account_id: "acct_1" }),
        "succeeded",
        "2026-04-19T10:11:00.000Z",
        "2026-04-19T10:11:00.000Z",
        "2026-04-19T10:11:30.000Z",
      ],
    );
    runtime.db.run(
      `INSERT INTO agent_tasks (
         id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status, created_at, started_at, finished_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "classify_task_2",
        "ws_1",
        "agent_def_1",
        "inbox.classify",
        "engagement_thread",
        "thread_blocked_classification",
        JSON.stringify({ thread_id: "thread_blocked_classification", account_id: "acct_1" }),
        "succeeded",
        "2026-04-19T10:26:00.000Z",
        "2026-04-19T10:26:00.000Z",
        "2026-04-19T10:26:30.000Z",
      ],
    );

    const readModel = new SqliteAccountAutomationOverviewReadModel(runtime.db);
    const overview = await readModel.getAccountAutomationOverview("acct_1");

    assert.ok(overview);
    assert.equal(overview?.next_classification_candidate_thread?.thread_id, "thread_new");
    assert.equal(overview?.next_reply_candidate_thread?.thread_id, "thread_classified");
    assert.equal(overview?.engagement_automation.pending_review_reply_count, 0);
    assert.equal(overview?.engagement_automation.approved_reply_pending_send_count, 0);
    assert.equal(overview?.engagement_automation.next_pending_review_reply, undefined);
    assert.equal(overview?.engagement_automation.next_approved_reply_pending_send, undefined);
  } finally {
    runtime.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("SqliteAccountAutomationOverviewReadModel suppresses engagement orchestration when policy is paused", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smartkols-orch-"));
  const dbPath = path.join(tempDir, "test.sqlite");
  const runtime = createSqliteRuntime(dbPath);

  try {
    runtime.db.run(
      `INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["ws_1", "Workspace", "workspace", "active", "2026-04-19T10:00:00.000Z", "2026-04-19T10:00:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO accounts (
         id, workspace_id, platform, handle, display_name, status,
         follower_count, following_count, post_count, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["acct_1", "ws_1", "x", "@acct", "Acct", "active", 0, 0, 0, "2026-04-19T10:00:00.000Z", "2026-04-19T10:00:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO engagement_policies (
         id, workspace_id, account_id, policy_body, status, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "policy_1",
        "ws_1",
        "acct_1",
        JSON.stringify({
          allowed_channels: ["mention", "dm", "reply", "comment"],
          blocked_classifications: [],
          require_manual_approval: true,
        }),
        "paused",
        "2026-04-19T10:00:00.000Z",
      ],
    );
    runtime.db.run(
      `INSERT INTO engagement_threads (
         id, workspace_id, account_id, channel, external_thread_id, classification, status, last_message_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["thread_1", "ws_1", "acct_1", "mention", "ext_1", "normal", "open", "2026-04-19T10:20:00.000Z", "2026-04-19T10:20:00.000Z"],
    );

    const readModel = new SqliteAccountAutomationOverviewReadModel(runtime.db);
    const overview = await readModel.getAccountAutomationOverview("acct_1");

    assert.ok(overview);
    assert.equal(overview?.next_classification_candidate_thread, undefined);
    assert.equal(overview?.next_reply_candidate_thread, undefined);
    assert.equal(overview?.engagement_automation.pending_review_reply_count, 0);
    assert.equal(overview?.engagement_automation.approved_reply_pending_send_count, 0);
    assert.equal(overview?.engagement_automation.next_pending_review_reply, undefined);
    assert.equal(overview?.engagement_automation.next_approved_reply_pending_send, undefined);
  } finally {
    runtime.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("SqliteAccountAutomationOverviewReadModel counts pending-review and approved reply proposals in the engagement backlog", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smartkols-orch-"));
  const dbPath = path.join(tempDir, "test.sqlite");
  const runtime = createSqliteRuntime(dbPath);

  try {
    runtime.db.run(
      `INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["ws_1", "Workspace", "workspace", "active", "2026-04-19T10:00:00.000Z", "2026-04-19T10:00:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO accounts (
         id, workspace_id, platform, handle, display_name, status,
         follower_count, following_count, post_count, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["acct_1", "ws_1", "x", "@acct", "Acct", "active", 0, 0, 0, "2026-04-19T10:00:00.000Z", "2026-04-19T10:00:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO engagement_policies (
         id, workspace_id, account_id, policy_body, status, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "policy_1",
        "ws_1",
        "acct_1",
        JSON.stringify({
          allowed_channels: ["mention", "dm", "reply", "comment"],
          blocked_classifications: [],
          require_manual_approval: true,
        }),
        "active",
        "2026-04-19T10:00:00.000Z",
      ],
    );
    runtime.db.run(
      `INSERT INTO engagement_threads (
         id, workspace_id, account_id, channel, external_thread_id, classification, status, last_message_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["thread_1", "ws_1", "acct_1", "mention", "ext_1", "normal", "open", "2026-04-19T10:05:00.000Z", "2026-04-19T10:05:00.000Z"],
    );
    runtime.db.run(
      `INSERT INTO agent_definitions (id, code, name, version, input_schema, output_schema, tool_policy, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "agent_def_1",
        "reply-proposer",
        "Reply Proposer",
        "v1",
        "{}",
        "{}",
        JSON.stringify({ ref: "test", tools: [] }),
        1,
      ],
    );
    runtime.db.run(
      `INSERT INTO agent_tasks (
         id, workspace_id, agent_definition_id, task_type, target_type, target_id, payload, status, created_at, started_at, finished_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "task_1",
        "ws_1",
        "agent_def_1",
        "engagement.reply_propose",
        "engagement_thread",
        "thread_1",
        JSON.stringify({ thread_id: "thread_1", account_id: "acct_1" }),
        "succeeded",
        "2026-04-19T10:04:00.000Z",
        "2026-04-19T10:04:00.000Z",
        "2026-04-19T10:04:30.000Z",
      ],
    );
    runtime.db.run(
      `INSERT INTO agent_runs (
         id, task_id, request_id, run_no, model_name, status, output, error_code, error_message, started_at, finished_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "run_1",
        "task_1",
        null,
        1,
        "gpt-5.4",
        "succeeded",
        JSON.stringify({ ok: true }),
        null,
        null,
        "2026-04-19T10:04:00.000Z",
        "2026-04-19T10:04:30.000Z",
      ],
    );
    runtime.db.run(
      `INSERT INTO engagement_reply_proposals (
         id, workspace_id, account_id, thread_id, agent_task_id, agent_run_id, status,
         content, rationale, connector_request_id, external_reply_id, created_at, reviewed_at, sent_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "proposal_pending",
        "ws_1",
        "acct_1",
        "thread_1",
        "task_1",
        "run_1",
        "pending_review",
        "reply text pending",
        "reply rationale pending",
        null,
        null,
        "2026-04-19T10:03:00.000Z",
        null,
        null,
      ],
    );
    runtime.db.run(
      `INSERT INTO engagement_reply_proposals (
         id, workspace_id, account_id, thread_id, agent_task_id, agent_run_id, status,
         content, rationale, connector_request_id, external_reply_id, created_at, reviewed_at, sent_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "proposal_1",
        "ws_1",
        "acct_1",
        "thread_1",
        "task_1",
        "run_1",
        "approved",
        "reply text",
        "reply rationale",
        null,
        null,
        "2026-04-19T10:05:00.000Z",
        "2026-04-19T10:06:00.000Z",
        null,
      ],
    );

    const readModel = new SqliteAccountAutomationOverviewReadModel(runtime.db);
    const overview = await readModel.getAccountAutomationOverview("acct_1");

    assert.ok(overview);
    assert.equal(overview?.engagement_automation.pending_review_reply_count, 1);
    assert.equal(overview?.engagement_automation.approved_reply_pending_send_count, 1);
    assert.equal(overview?.engagement_automation.next_pending_review_reply?.proposal_id, "proposal_pending");
    assert.equal(overview?.engagement_automation.next_pending_review_reply?.thread_id, "thread_1");
    assert.equal(overview?.engagement_automation.next_approved_reply_pending_send?.proposal_id, "proposal_1");
    assert.equal(overview?.engagement_automation.next_approved_reply_pending_send?.thread_id, "thread_1");
  } finally {
    runtime.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
