export const OWNER_ID_HEADER = "x-paisa-watch-verified-owner-id";
export const OWNER_EMAIL_HEADER = "x-paisa-watch-verified-owner-email";

export type RequestIdentity = {
  ownerId: string;
  email: string | null;
};

export function withVerifiedRequestIdentity(
  incomingHeaders: Headers,
  identity: RequestIdentity | null
): Headers {
  const forwardedHeaders = new Headers(incomingHeaders);
  forwardedHeaders.delete(OWNER_ID_HEADER);
  forwardedHeaders.delete(OWNER_EMAIL_HEADER);

  if (identity) {
    forwardedHeaders.set(OWNER_ID_HEADER, identity.ownerId);
    if (identity.email) {
      // Header values must be bytes ≤255; internationalized emails are not.
      forwardedHeaders.set(OWNER_EMAIL_HEADER, encodeURIComponent(identity.email));
    }
  }

  return forwardedHeaders;
}

export function readRequestIdentity(headers: Pick<Headers, "get">): RequestIdentity | null {
  const ownerId = headers.get(OWNER_ID_HEADER);
  if (!ownerId) {
    return null;
  }

  const email = headers.get(OWNER_EMAIL_HEADER);
  return {
    ownerId,
    email: email === null ? null : decodeURIComponent(email)
  };
}
