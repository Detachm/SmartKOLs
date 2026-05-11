import type { AlertChannelKind, AlertChannelSecret } from "../../domain/alert-channel";

export interface AlertChannelSecretStore {
  upsertSecret(existingSecretRef: string | undefined, kind: AlertChannelKind, secret: AlertChannelSecret): Promise<string>;
  deleteSecret(secretRef: string | undefined): Promise<void>;
}
