import type { ContentBrief } from "../../domain/content-brief";
import type { ContentBriefEvidenceItem } from "../../domain/content-brief-evidence-item";

export interface ContentBriefsRepository {
  findBriefById(briefId: string): Promise<ContentBrief | null>;
  listBriefsByAccountId(accountId: string, limit: number): Promise<Array<ContentBrief & { evidence_count: number }>>;
  saveBrief(brief: ContentBrief): Promise<void>;
  listEvidenceByBriefId(briefId: string): Promise<ContentBriefEvidenceItem[]>;
  listEvidenceByBriefIds(briefIds: string[]): Promise<ContentBriefEvidenceItem[]>;
  replaceEvidenceItems(briefId: string, items: ContentBriefEvidenceItem[]): Promise<void>;
}
