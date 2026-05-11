import test from "node:test";
import assert from "node:assert/strict";
import { SqliteContentBriefsRepository } from "./sqlite-content-briefs-repository";

test("SqliteContentBriefsRepository normalizes nullable optional fields to undefined", async () => {
  const repository = new SqliteContentBriefsRepository({
    get: () => ({
      id: "brief_1",
      workspace_id: "ws_1",
      account_id: "acct_1",
      trend_id: null,
      status: "queued",
      generation_mode: "from_trend",
      topic_hint: null,
      topic: null,
      angle: null,
      audience: null,
      outline: null,
      source_scope: null,
      generated_by_run_id: null,
      error_code: null,
      error_message: null,
      created_at: "2026-04-21T10:00:00.000Z",
      updated_at: "2026-04-21T10:00:00.000Z",
    }),
    all: () => [],
    run: () => ({ changes: 0 }),
    transaction: () => undefined,
  } as never);

  const brief = await repository.findBriefById("brief_1");

  assert.ok(brief);
  assert.equal(brief?.topic_hint, undefined);
  assert.equal(brief?.source_scope, undefined);
  assert.equal(brief?.error_message, undefined);
});
