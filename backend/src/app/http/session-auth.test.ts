import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../core/errors/app-error";
import {
  assertResourceWorkspace,
  assertSessionAccess,
  assertSessionUser,
  assertSessionWorkspace,
  readAuthenticatedSessionFromRequest,
} from "./session-auth";

function createDbStub(rows: Record<string, { workspace_id: string } | null>) {
  return {
    get<T>(sql: string, params?: unknown[]) {
      const key = `${sql}::${JSON.stringify(params ?? [])}`;
      return (rows[key] ?? null) as T | null;
    },
  };
}

test("readAuthenticatedSessionFromRequest parses validated session headers", () => {
  const request = new Request("http://localhost/test", {
    headers: {
      "x-smartkols-user-id": "user-1",
      "x-smartkols-workspace-id": "ws-1",
    },
  });

  assert.deepEqual(readAuthenticatedSessionFromRequest(request), {
    user_id: "user-1",
    workspace_id: "ws-1",
  });
});

test("assertSessionWorkspace injects current workspace when query omits workspace_id", () => {
  const workspaceId = assertSessionWorkspace({ user_id: "user-1", workspace_id: "ws-1" }, undefined);
  assert.equal(workspaceId, "ws-1");
});

test("assertSessionWorkspace rejects cross-workspace access", () => {
  assert.throws(
    () => assertSessionWorkspace({ user_id: "user-1", workspace_id: "ws-1" }, "ws-2"),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});

test("assertSessionUser rejects another user context", () => {
  assert.throws(
    () => assertSessionUser({ user_id: "user-1", workspace_id: "ws-1" }, "user-2"),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});

test("assertSessionAccess rejects sessions without membership", async () => {
  const db = createDbStub({});

  await assert.rejects(
    () => assertSessionAccess(db as never, { user_id: "user-1", workspace_id: "ws-1" }),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});

test("assertResourceWorkspace rejects resources outside the authenticated workspace", async () => {
  const sql = "SELECT workspace_id FROM accounts WHERE id = ?";
  const db = createDbStub({
    [`${sql}::["account-1"]`]: { workspace_id: "ws-2" },
  });

  await assert.rejects(
    () => assertResourceWorkspace(
      db as never,
      { user_id: "user-1", workspace_id: "ws-1" },
      { type: "account", id: "account-1" },
    ),
    (error) => error instanceof AppError && error.code === "FORBIDDEN",
  );
});

test("assertResourceWorkspace supports source watchlists and recurring brief plans", async () => {
  const sourceWatchlistSql = "SELECT workspace_id FROM source_watchlists WHERE id = ?";
  const recurringPlanSql = "SELECT workspace_id FROM recurring_brief_plans WHERE id = ?";
  const db = createDbStub({
    [`${sourceWatchlistSql}::["watch-1"]`]: { workspace_id: "ws-1" },
    [`${recurringPlanSql}::["plan-1"]`]: { workspace_id: "ws-1" },
  });

  await assert.doesNotReject(() => assertResourceWorkspace(
    db as never,
    { user_id: "user-1", workspace_id: "ws-1" },
    { type: "source_watchlist", id: "watch-1" },
  ));
  await assert.doesNotReject(() => assertResourceWorkspace(
    db as never,
    { user_id: "user-1", workspace_id: "ws-1" },
    { type: "recurring_brief_plan", id: "plan-1" },
  ));
});
