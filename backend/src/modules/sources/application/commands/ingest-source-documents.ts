import crypto from "crypto";
import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../ports/sources-repository";
import { createSourceDocument, type SourceDocument } from "../../domain/source-document";
import { createSource } from "../../domain/source";

export interface IngestSourceDocumentsDependencies {
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class IngestSourceDocuments {
  constructor(private readonly deps: IngestSourceDocumentsDependencies) {}

  async execute(
    sourceId: string,
    input: Array<{
      external_doc_id?: string;
      canonical_url: string;
      title: string;
      summary?: string;
      body_text: string;
      language: string;
      published_at?: string;
    }>,
  ) {
    const source = await this.deps.sources.findSourceById(sourceId);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: sourceId },
      });
    }

    let importedCount = 0;
    const now = this.deps.clock.now().toISOString();
    for (const item of input) {
      const contentHash = crypto.createHash("sha256")
        .update([item.canonical_url, item.title, item.body_text].join("\n"))
        .digest("hex");

      const existing = await this.deps.sources.findDocumentByContentHash(source.id, contentHash);
      if (existing) {
        continue;
      }

      const document = createSourceDocument({
        id: newId(),
        workspace_id: source.workspace_id,
        source_id: source.id,
        external_doc_id: item.external_doc_id,
        canonical_url: item.canonical_url,
        title: item.title,
        summary: item.summary ?? "",
        body_text: item.body_text,
        language: item.language,
        published_at: item.published_at,
        content_hash: contentHash,
        created_at: now,
      });
      await this.deps.sources.createDocument(document);
      importedCount += 1;
    }

    await this.deps.sources.saveSource(createSource({
      ...source,
      last_fetched_at: now,
    }));
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: source.workspace_id,
      actor_type: "system",
      entity_type: "source",
      entity_id: source.id,
      action: "source.documents_ingested",
      after_state: JSON.stringify({ imported_count: importedCount }),
      created_at: now,
    });

    return { imported_count: importedCount };
  }
}
