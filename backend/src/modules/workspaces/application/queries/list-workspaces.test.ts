import test from "node:test";
import assert from "node:assert/strict";
import { ListWorkspaces } from "./list-workspaces";

test("ListWorkspaces returns only memberships for the authenticated user", async () => {
  const query = new ListWorkspaces({
    members: {
      async find() {
        return null;
      },
      async listByWorkspaceId() {
        return [];
      },
      async listByUserId(userId: string) {
        assert.equal(userId, "user-1");
        return [
          { workspace_id: "ws-1", user_id: "user-1", role_code: "owner", joined_at: "2026-04-19T00:00:00.000Z" },
          { workspace_id: "ws-2", user_id: "user-1", role_code: "editor", joined_at: "2026-04-19T00:00:00.000Z" },
        ];
      },
      async save() {},
      async delete() {},
    },
    workspaces: {
      async findById(workspaceId: string) {
        return {
          id: workspaceId,
          name: workspaceId === "ws-1" ? "Workspace A" : "Workspace B",
          slug: workspaceId,
          status: "active" as const,
          created_at: "2026-04-19T00:00:00.000Z",
          updated_at: "2026-04-19T00:00:00.000Z",
        };
      },
      async findBySlug() {
        return null;
      },
      async listAll() {
        return [];
      },
      async create() {},
      async save() {},
    },
  });

  const result = await query.execute("user-1");
  assert.deepEqual(result.workspaces.map((workspace) => workspace.id), ["ws-1", "ws-2"]);
});
