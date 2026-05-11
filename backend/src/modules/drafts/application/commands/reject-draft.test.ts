import test from "node:test";
import assert from "node:assert/strict";
import { RejectDraft } from "./reject-draft";

test("RejectDraft allows failed publish drafts to be rejected for operator cleanup", async () => {
  let savedStatus: string | undefined;
  let reviewAction: string | undefined;
  let queuedFollowUp = false;

  const command = new RejectDraft({
    drafts: {
      findById: async () => ({
        id: "draft_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "failed",
        topic: "failed publish",
        current_version_id: "version_1",
        created_at: "2026-04-26T07:00:00.000Z",
        updated_at: "2026-04-26T07:15:00.000Z",
      }),
      save: async (draft: { status: string }) => {
        savedStatus = draft.status;
      },
      appendReview: async (review: { action: string }) => {
        reviewAction = review.action;
      },
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    queueAccountAutomationTick: {
      execute: async () => {
        queuedFollowUp = true;
        return undefined;
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-26T07:20:00.000Z"),
    },
  });

  const result = await command.execute("draft_1", {
    reviewer_type: "user",
    reviewer_id: "user_1",
    comment: "archive failed publish",
  });

  assert.equal(result.status, "rejected");
  assert.equal(savedStatus, "rejected");
  assert.equal(reviewAction, "reject");
  assert.equal(queuedFollowUp, true);
});
