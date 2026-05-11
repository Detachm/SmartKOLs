import type { AppCommandSearchResponse, AppCommandSearchResult } from "../../../contracts/api/app-chrome";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AppCommandSearchReadModel } from "../application/queries/search-app-command-targets";

interface AccountSearchRow {
  id: string;
  workspace_id: string;
  group_id?: string | null;
  handle: string;
  display_name: string;
  status: "active" | "paused" | "disabled" | "error";
  group_name?: string | null;
  updated_at: string;
}

interface GroupSearchRow {
  id: string;
  workspace_id: string;
  name: string;
  account_count: number;
  active_account_count: number;
  created_at: string;
}

interface DraftSearchRow {
  id: string;
  account_id: string;
  topic: string;
  status: "pending" | "approved" | "rejected" | "scheduled" | "published" | "failed";
  updated_at: string;
  account_handle: string;
  account_display_name: string;
}

interface ContentBriefSearchRow {
  id: string;
  account_id: string;
  status: "queued" | "running" | "ready" | "failed" | "archived";
  topic?: string | null;
  topic_hint?: string | null;
  updated_at: string;
  account_handle: string;
  account_display_name: string;
}

const STATIC_PAGES: Array<{
  id: string;
  page_code: "dashboard" | "accounts" | "calendar" | "drafts" | "monitoring" | "settings";
  label: string;
  sublabel: string;
  href: string;
  aliases: string[];
}> = [
  { id: "dashboard", page_code: "dashboard", label: "概览", sublabel: "Dashboard", href: "/dashboard", aliases: ["dashboard", "overview", "概览", "首页"] },
  { id: "accounts", page_code: "accounts", label: "账号管理", sublabel: "Accounts", href: "/accounts", aliases: ["accounts", "account", "账号", "账号管理", "workspace"] },
  { id: "calendar", page_code: "calendar", label: "内容日历", sublabel: "Calendar", href: "/calendar", aliases: ["calendar", "日历", "排期", "schedule"] },
  { id: "drafts", page_code: "drafts", label: "内容审核", sublabel: "Drafts", href: "/drafts", aliases: ["draft", "drafts", "草稿", "审核"] },
  { id: "monitoring", page_code: "monitoring", label: "监控中心", sublabel: "Monitoring", href: "/monitoring", aliases: ["monitoring", "ops", "监控", "报警", "排障"] },
  { id: "settings", page_code: "settings", label: "设置", sublabel: "Settings", href: "/settings", aliases: ["settings", "setting", "设置", "团队"] },
];

export class SqliteAppCommandSearchReadModel implements AppCommandSearchReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async search(input: {
    workspace_id: string;
    query: string;
    limit: number;
  }): Promise<AppCommandSearchResponse> {
    const normalizedQuery = input.query.trim().toLowerCase();
    const handleQuery = normalizedQuery.replace(/^@+/, "");
    const containsPattern = `%${handleQuery}%`;
    const prefixPattern = `${handleQuery}%`;
    const sectionLimit = Math.max(4, Math.min(8, input.limit));

    const pageResults = searchStaticPages(normalizedQuery);
    const groupResults = this.searchGroups(input.workspace_id, normalizedQuery, containsPattern, prefixPattern, sectionLimit);
    const accountResults = this.searchAccounts(input.workspace_id, normalizedQuery, handleQuery, containsPattern, prefixPattern, sectionLimit);
    const draftResults = this.searchDrafts(input.workspace_id, normalizedQuery, containsPattern, prefixPattern, sectionLimit);
    const briefResults = this.searchContentBriefs(input.workspace_id, normalizedQuery, containsPattern, prefixPattern, sectionLimit);

    return {
      query: input.query,
      results: [
        ...pageResults,
        ...accountResults,
        ...groupResults,
        ...draftResults,
        ...briefResults,
      ].slice(0, input.limit),
    };
  }

  private searchAccounts(
    workspaceId: string,
    normalizedQuery: string,
    handleQuery: string,
    containsPattern: string,
    prefixPattern: string,
    limit: number,
  ): AppCommandSearchResult[] {
    return this.db.all<AccountSearchRow>(
      `SELECT
        a.id,
        a.workspace_id,
        a.group_id,
        a.handle,
        a.display_name,
        a.status,
        g.name AS group_name,
        a.updated_at
      FROM accounts a
      LEFT JOIN account_groups g ON g.id = a.group_id
      WHERE a.workspace_id = ?
        AND (
          ? = ''
          OR LOWER(a.handle) LIKE ?
          OR LOWER(a.display_name) LIKE ?
          OR LOWER(COALESCE(g.name, '')) LIKE ?
        )
      ORDER BY
        CASE
          WHEN ? <> '' AND LOWER(a.handle) = ? THEN 0
          WHEN ? <> '' AND LOWER(a.handle) LIKE ? THEN 1
          WHEN ? <> '' AND LOWER(a.display_name) LIKE ? THEN 2
          ELSE 3
        END,
        a.updated_at DESC,
        a.id DESC
      LIMIT ?`,
      [
        workspaceId,
        normalizedQuery,
        containsPattern,
        containsPattern,
        containsPattern,
        handleQuery,
        handleQuery,
        handleQuery,
        prefixPattern,
        normalizedQuery,
        `${normalizedQuery}%`,
        limit,
      ],
    ).map((row) => ({
      id: row.id,
      kind: "account",
      label: row.display_name,
      sublabel: `${row.handle}${row.group_name ? ` · ${row.group_name}` : ""}`,
      href: `/accounts/${encodeURIComponent(row.id)}/persona`,
      badge: accountStatusLabel(row.status),
      updated_at: row.updated_at,
    }));
  }

  private searchGroups(
    workspaceId: string,
    normalizedQuery: string,
    containsPattern: string,
    prefixPattern: string,
    limit: number,
  ): AppCommandSearchResult[] {
    return this.db.all<GroupSearchRow>(
      `SELECT
        g.id,
        g.workspace_id,
        g.name,
        COUNT(a.id) AS account_count,
        COALESCE(SUM(CASE WHEN a.status = 'active' THEN 1 ELSE 0 END), 0) AS active_account_count,
        g.created_at
      FROM account_groups g
      LEFT JOIN accounts a ON a.group_id = g.id
      WHERE g.workspace_id = ?
        AND (? = '' OR LOWER(g.name) LIKE ?)
      GROUP BY g.id, g.workspace_id, g.name, g.created_at
      ORDER BY
        CASE
          WHEN ? <> '' AND LOWER(g.name) LIKE ? THEN 0
          ELSE 1
        END,
        account_count DESC,
        g.created_at DESC,
        g.id DESC
      LIMIT ?`,
      [
        workspaceId,
        normalizedQuery,
        containsPattern,
        normalizedQuery,
        prefixPattern,
        limit,
      ],
    ).map((row) => ({
      id: row.id,
      kind: "account_group",
      label: row.name,
      sublabel: `${row.account_count} 个账号 · ${row.active_account_count} active`,
      href: `/accounts?workspace_id=${encodeURIComponent(row.workspace_id)}&group_id=${encodeURIComponent(row.id)}`,
      badge: `${row.account_count}`,
      updated_at: row.created_at,
    }));
  }

  private searchDrafts(
    workspaceId: string,
    normalizedQuery: string,
    containsPattern: string,
    prefixPattern: string,
    limit: number,
  ): AppCommandSearchResult[] {
    return this.db.all<DraftSearchRow>(
      `SELECT
        d.id,
        d.account_id,
        d.topic,
        d.status,
        d.updated_at,
        a.handle AS account_handle,
        a.display_name AS account_display_name
      FROM drafts d
      INNER JOIN accounts a ON a.id = d.account_id
      WHERE d.workspace_id = ?
        AND (
          ? = ''
          OR LOWER(d.topic) LIKE ?
          OR LOWER(a.handle) LIKE ?
          OR LOWER(a.display_name) LIKE ?
        )
      ORDER BY
        CASE
          WHEN ? <> '' AND LOWER(d.topic) LIKE ? THEN 0
          WHEN ? <> '' AND LOWER(a.handle) LIKE ? THEN 1
          ELSE 2
        END,
        d.updated_at DESC,
        d.id DESC
      LIMIT ?`,
      [
        workspaceId,
        normalizedQuery,
        containsPattern,
        containsPattern,
        containsPattern,
        normalizedQuery,
        prefixPattern,
        normalizedQuery,
        prefixPattern,
        limit,
      ],
    ).map((row) => ({
      id: row.id,
      kind: "draft",
      label: row.topic,
      sublabel: `${row.account_display_name} · ${row.account_handle}`,
      href: `/accounts/${encodeURIComponent(row.account_id)}/preview?draft_id=${encodeURIComponent(row.id)}`,
      badge: draftStatusLabel(row.status),
      updated_at: row.updated_at,
    }));
  }

  private searchContentBriefs(
    workspaceId: string,
    normalizedQuery: string,
    containsPattern: string,
    prefixPattern: string,
    limit: number,
  ): AppCommandSearchResult[] {
    return this.db.all<ContentBriefSearchRow>(
      `SELECT
        cb.id,
        cb.account_id,
        cb.status,
        cb.topic,
        cb.topic_hint,
        cb.updated_at,
        a.handle AS account_handle,
        a.display_name AS account_display_name
      FROM content_briefs cb
      INNER JOIN accounts a ON a.id = cb.account_id
      WHERE cb.workspace_id = ?
        AND (
          ? = ''
          OR LOWER(COALESCE(cb.topic, cb.topic_hint, '')) LIKE ?
          OR LOWER(a.handle) LIKE ?
          OR LOWER(a.display_name) LIKE ?
        )
      ORDER BY
        CASE
          WHEN cb.status = 'ready' THEN 0
          WHEN cb.status = 'running' THEN 1
          WHEN cb.status = 'queued' THEN 2
          ELSE 3
        END,
        CASE
          WHEN ? <> '' AND LOWER(COALESCE(cb.topic, cb.topic_hint, '')) LIKE ? THEN 0
          ELSE 1
        END,
        cb.updated_at DESC,
        cb.id DESC
      LIMIT ?`,
      [
        workspaceId,
        normalizedQuery,
        containsPattern,
        containsPattern,
        containsPattern,
        normalizedQuery,
        prefixPattern,
        limit,
      ],
    ).map((row) => ({
      id: row.id,
      kind: "content_brief",
      label: row.topic ?? row.topic_hint ?? `Brief ${row.id}`,
      sublabel: `${row.account_display_name} · ${row.account_handle}`,
      href: `/accounts/${encodeURIComponent(row.account_id)}/preview?brief_id=${encodeURIComponent(row.id)}`,
      badge: contentBriefStatusLabel(row.status),
      updated_at: row.updated_at,
    }));
  }
}

function searchStaticPages(query: string): AppCommandSearchResult[] {
  return STATIC_PAGES
    .filter((item) => {
      if (query === "") {
        return true;
      }

      return item.aliases.some((alias) => alias.toLowerCase().includes(query));
    })
    .map((item) => ({
      id: item.id,
      kind: "page",
      page_code: item.page_code,
      label: item.label,
      sublabel: item.sublabel,
      href: item.href,
    }));
}

function accountStatusLabel(status: AccountSearchRow["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "disabled":
      return "Disabled";
    case "error":
      return "Error";
  }
}

function draftStatusLabel(status: DraftSearchRow["status"]): string {
  switch (status) {
    case "pending":
      return "待审核";
    case "approved":
      return "已批准";
    case "rejected":
      return "已拒绝";
    case "scheduled":
      return "已排期";
    case "published":
      return "已发布";
    case "failed":
      return "失败";
  }
}

function contentBriefStatusLabel(status: ContentBriefSearchRow["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "archived":
      return "Archived";
  }
}
