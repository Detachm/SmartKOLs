import { ok } from "../../../../core/result/result";
import type { GetAccountsControlPlane } from "../../../../modules/accounts/application/queries/get-accounts-control-plane";

export async function getAccountsControlPlaneHandler(query: GetAccountsControlPlane, workspaceId?: string) {
  return ok(await query.execute(workspaceId));
}
