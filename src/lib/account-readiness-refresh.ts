export const ACCOUNT_READINESS_REFRESH_EVENT = "smartkols:account-readiness-refresh";

export function notifyAccountReadinessChanged(accountId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(ACCOUNT_READINESS_REFRESH_EVENT, {
    detail: { accountId },
  }));
}

export function isAccountReadinessRefreshEvent(event: Event, accountId: string): boolean {
  if (!(event instanceof CustomEvent)) {
    return false;
  }

  const detail = event.detail as { accountId?: unknown } | undefined;
  return typeof detail?.accountId === "string" && detail.accountId === accountId;
}
