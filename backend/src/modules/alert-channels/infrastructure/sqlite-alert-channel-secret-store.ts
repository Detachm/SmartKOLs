import type { Clock } from "../../../core/time/clock";
import type { AlertChannelSecretStore } from "../application/ports/alert-channel-secret-store";
import type { AlertChannelKind, AlertChannelSecret } from "../domain/alert-channel";
import type { ManagedSecretVault } from "../../secrets/application/ports/managed-secret-vault";

export class SqliteAlertChannelSecretStore implements AlertChannelSecretStore {
  constructor(
    private readonly vault: ManagedSecretVault,
    private readonly clock: Clock,
  ) {}

  async upsertSecret(existingSecretRef: string | undefined, kind: AlertChannelKind, secret: AlertChannelSecret): Promise<string> {
    const now = this.clock.now().toISOString();
    return this.vault.upsertJsonSecret(existingSecretRef, {
      namespace: "alert_channel",
      kind,
      secret,
      now,
    });
  }

  async deleteSecret(secretRef: string | undefined): Promise<void> {
    await this.vault.deleteManagedSecret(secretRef, {
      namespace: "alert_channel",
    });
  }
}
