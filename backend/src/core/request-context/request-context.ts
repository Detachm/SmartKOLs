import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestScope {
  request_id: string;
  authenticated_user_id?: string;
  authenticated_workspace_id?: string;
}

export class RequestContextStore {
  private readonly storage = new AsyncLocalStorage<RequestScope>();

  run<T>(scope: RequestScope, callback: () => T): T {
    return this.storage.run(scope, callback);
  }

  getRequestId(): string | undefined {
    return this.storage.getStore()?.request_id;
  }

  getAuthenticatedUserId(): string | undefined {
    return this.storage.getStore()?.authenticated_user_id;
  }

  getAuthenticatedWorkspaceId(): string | undefined {
    return this.storage.getStore()?.authenticated_workspace_id;
  }
}
