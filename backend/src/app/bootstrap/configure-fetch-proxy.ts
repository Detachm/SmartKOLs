import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

let fetchProxyConfigured = false;

export function configureFetchProxyFromEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (fetchProxyConfigured) {
    return;
  }

  const hasProxy =
    hasValue(env.HTTPS_PROXY)
    || hasValue(env.https_proxy)
    || hasValue(env.HTTP_PROXY)
    || hasValue(env.http_proxy)
    || hasValue(env.ALL_PROXY)
    || hasValue(env.all_proxy);

  if (!hasProxy) {
    fetchProxyConfigured = true;
    return;
  }

  setGlobalDispatcher(new EnvHttpProxyAgent());
  fetchProxyConfigured = true;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}
