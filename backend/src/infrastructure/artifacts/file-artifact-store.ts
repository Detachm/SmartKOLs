import fs from "fs";
import path from "path";
import { AppError } from "../../core/errors/app-error";
import type { ArtifactStore, TextArtifactWriteInput } from "../../core/artifacts/artifact-store";

export class FileArtifactStore implements ArtifactStore {
  constructor(private readonly rootDir: string) {}

  async writeText(input: TextArtifactWriteInput): Promise<string> {
    const category = sanitizeSegment(input.category);
    const key = sanitizeSegment(input.key);
    const relativePath = path.join(category, `${key}.${input.extension}`);
    const absolutePath = path.join(this.rootDir, relativePath);

    try {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, input.content, "utf8");
    } catch (error) {
      throw new AppError("INTERNAL_ERROR", "failed to persist artifact file", {
        details: { artifact_path: absolutePath, category: input.category, key: input.key },
        cause: error,
      });
    }

    return relativePath;
  }
}

function sanitizeSegment(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new AppError("INTERNAL_ERROR", "artifact path segment cannot be empty");
  }

  return trimmed.replace(/[^A-Za-z0-9/_-]+/g, "_");
}
