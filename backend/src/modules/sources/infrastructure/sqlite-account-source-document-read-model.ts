import type { AccountSourceDocumentListResponse } from "../../../contracts/api/sources";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AccountSourceDocumentsReadModel } from "../application/queries/list-account-source-documents";

interface AccountSourceDocumentRow {
  document_id: string;
  document_workspace_id: string;
  document_source_id: string;
  document_external_doc_id?: string | null;
  document_canonical_url: string;
  document_title: string;
  document_summary: string;
  document_body_text: string;
  document_language: string;
  document_published_at?: string | null;
  document_content_hash: string;
  document_created_at: string;
  source_id: string;
  source_workspace_id: string;
  source_account_id: string;
  source_type: "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
  source_name: string;
  source_url: string;
  source_status: "active" | "paused" | "error";
  source_last_fetched_at?: string | null;
  source_created_at: string;
}

export class SqliteAccountSourceDocumentReadModel implements AccountSourceDocumentsReadModel {
  constructor(private readonly db: SqliteExecutor) {}

  async listAccountSourceDocuments(input: {
    account_id: string;
    source_id?: string;
    source_ids?: string[];
    source_type?: "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
    source_types?: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
    source_status?: "active" | "paused" | "error";
    query?: string;
    published_from?: string;
    published_to?: string;
    limit: number;
  }): Promise<AccountSourceDocumentListResponse> {
    const conditions = ["s.account_id = ?"];
    const params: Array<string | number> = [input.account_id];

    if (input.source_id) {
      conditions.push("s.id = ?");
      params.push(input.source_id);
    }
    if (input.source_ids && input.source_ids.length > 0) {
      conditions.push(`s.id IN (${input.source_ids.map(() => "?").join(", ")})`);
      params.push(...input.source_ids);
    }
    if (input.source_type) {
      conditions.push("s.type = ?");
      params.push(input.source_type);
    }
    if (input.source_types && input.source_types.length > 0) {
      conditions.push(`s.type IN (${input.source_types.map(() => "?").join(", ")})`);
      params.push(...input.source_types);
    }
    if (input.source_status) {
      conditions.push("s.status = ?");
      params.push(input.source_status);
    }
    if (input.published_from) {
      conditions.push("COALESCE(sd.published_at, sd.created_at) >= ?");
      params.push(input.published_from);
    }
    if (input.published_to) {
      conditions.push("COALESCE(sd.published_at, sd.created_at) <= ?");
      params.push(input.published_to);
    }
    if (input.query) {
      conditions.push("(LOWER(sd.title) LIKE ? OR LOWER(sd.summary) LIKE ? OR LOWER(sd.body_text) LIKE ? OR LOWER(sd.canonical_url) LIKE ? OR LOWER(s.name) LIKE ?)");
      const pattern = `%${input.query.toLowerCase()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    params.push(input.limit);

    const rows = this.db.all<AccountSourceDocumentRow>(
      `SELECT
        sd.id AS document_id,
        sd.workspace_id AS document_workspace_id,
        sd.source_id AS document_source_id,
        sd.external_doc_id AS document_external_doc_id,
        sd.canonical_url AS document_canonical_url,
        sd.title AS document_title,
        sd.summary AS document_summary,
        sd.body_text AS document_body_text,
        sd.language AS document_language,
        sd.published_at AS document_published_at,
        sd.content_hash AS document_content_hash,
        sd.created_at AS document_created_at,
        s.id AS source_id,
        s.workspace_id AS source_workspace_id,
        s.account_id AS source_account_id,
        s.type AS source_type,
        s.name AS source_name,
        s.url AS source_url,
        s.status AS source_status,
        s.last_fetched_at AS source_last_fetched_at,
        s.created_at AS source_created_at
      FROM source_documents sd
      INNER JOIN sources s ON s.id = sd.source_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY COALESCE(sd.published_at, sd.created_at) DESC
      LIMIT ?`,
      params,
    );

    return {
      documents: rows.map((row) => ({
        document: {
          id: row.document_id,
          workspace_id: row.document_workspace_id,
          source_id: row.document_source_id,
          external_doc_id: row.document_external_doc_id ?? undefined,
          canonical_url: row.document_canonical_url,
          title: row.document_title,
          summary: row.document_summary,
          body_text: row.document_body_text,
          language: row.document_language,
          published_at: row.document_published_at ?? undefined,
          content_hash: row.document_content_hash,
          created_at: row.document_created_at,
        },
        source: {
          id: row.source_id,
          workspace_id: row.source_workspace_id,
          account_id: row.source_account_id,
          type: row.source_type,
          name: row.source_name,
          url: row.source_url,
          status: row.source_status,
          last_fetched_at: row.source_last_fetched_at ?? undefined,
          created_at: row.source_created_at,
        },
      })),
    };
  }
}
