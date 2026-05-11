import type { DraftVersion } from "../../domain/draft-version";

export interface DraftVersionRepository {
  getNextVersionNumber(draftId: string): Promise<number>;
  findById(versionId: string): Promise<DraftVersion | null>;
  create(version: DraftVersion): Promise<void>;
}
