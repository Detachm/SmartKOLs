import crypto from "crypto";

export interface OAuth1AuthorizationInput {
  method: string;
  url: URL;
  consumer_key: string;
  consumer_secret: string;
  token: string;
  token_secret: string;
}

export function createOAuth1AuthorizationHeader(input: OAuth1AuthorizationInput): string {
  const oauthParams = {
    oauth_consumer_key: input.consumer_key,
    oauth_nonce: createNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: input.token,
    oauth_version: "1.0",
  };

  const signature = createSignature(input, oauthParams);
  const headerParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return `OAuth ${Object.entries(headerParams)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(", ")}`;
}

function createSignature(
  input: OAuth1AuthorizationInput,
  oauthParams: Record<string, string>,
): string {
  const parameterString = [
    ...collectQueryParameters(input.url),
    ...Object.entries(oauthParams),
  ]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyCompare = leftKey.localeCompare(rightKey);
      if (keyCompare !== 0) {
        return keyCompare;
      }
      return leftValue.localeCompare(rightValue);
    })
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");

  const signatureBaseString = [
    input.method.toUpperCase(),
    percentEncode(`${input.url.origin}${input.url.pathname}`),
    percentEncode(parameterString),
  ].join("&");
  const signingKey = `${percentEncode(input.consumer_secret)}&${percentEncode(input.token_secret)}`;

  return crypto.createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");
}

function collectQueryParameters(url: URL): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    result.push([key, value]);
  });
  return result;
}

function createNonce(): string {
  return crypto.randomBytes(32).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
}

function percentEncode(input: string): string {
  return encodeURIComponent(input).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
