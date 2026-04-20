export interface ManagedSecretVault {
  readJsonSecret(
    secretRef: string,
    input: {
      namespace: string;
      expected_kinds: readonly string[];
    },
  ): Promise<Record<string, unknown>>;
  upsertJsonSecret(
    existingSecretRef: string | undefined,
    input: {
      namespace: string;
      kind: string;
      secret: object;
      now: string;
    },
  ): Promise<string>;
  deleteManagedSecret(
    secretRef: string | undefined,
    input?: {
      namespace?: string;
    },
  ): Promise<void>;
  migrateLegacySecrets(): Promise<void>;
}
