export interface TextArtifactWriteInput {
  category: string;
  key: string;
  content: string;
  extension: "txt" | "json" | "xml";
}

export interface ArtifactStore {
  writeText(input: TextArtifactWriteInput): Promise<string>;
}
