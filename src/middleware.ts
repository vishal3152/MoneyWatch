import { NextResponse, type NextRequest } from "next/server";

import { getAuthProvider } from "@/config/auth-provider";
import { isCloudMode } from "@/config/deployment-mode";
import { shouldRedirectToLogin } from "@/lib/cloud-auth/session-gate";
import {
  withVerifiedRequestIdentity,
  type RequestIdentity
} from "@/lib/cloud-auth/request-identity";

const ASSET_PATH = /\.(?:ico|svg|png|jpg|jpeg|gif|webp)$/;

export async function middleware(request: NextRequest) {
  if (!isCloudMode()) {
    return NextResponse.next();
  }

  // Assets skip the session gate so /login can load its images, but dynamic
  // pages also match these paths and must never receive client-forged identity.
  if (ASSET_PATH.test(request.nextUrl.pathname)) {
    return NextResponse.next({
      request: { headers: withVerifiedRequestIdentity(request.headers, null) }
    });
  }

  if (getAuthProvider() === "simple") {
    // Load the simple-auth module only on this path — the Supabase path below never does.
    const { SIMPLE_SESSION_COOKIE, deriveOwnerId, verifySessionToken } = await import(
      "@/lib/simple-auth/session"
    );
    const simpleIdentity = await verifySessionToken(
      request.cookies.get(SIMPLE_SESSION_COOKIE)?.value
    );
    const identity: RequestIdentity | null = simpleIdentity
      ? {
          ownerId: await deriveOwnerId(simpleIdentity.email),
          email: simpleIdentity.email
        }
      : null;

    if (
      shouldRedirectToLogin({
        isCloudMode: true,
        hasSession: identity !== null,
        pathname: request.nextUrl.pathname
      })
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next({
      request: { headers: withVerifiedRequestIdentity(request.headers, identity) }
    });
  }

  // Load Supabase only on the cloud path — local/desktop never evaluates the SDK.
  const { createServerClient } = await import("@supabase/ssr");
  const { getIdentityFromSession } = await import("@/lib/cloud-auth/current-owner");

  const refreshResponse = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            refreshResponse.cookies.set(name, value, options)
          );
        }
      }
    }
  );
  const identity = await getIdentityFromSession(supabase);

  if (
    shouldRedirectToLogin({
      isCloudMode: true,
      hasSession: identity !== null,
      pathname: request.nextUrl.pathname
    })
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next({
    request: { headers: withVerifiedRequestIdentity(request.headers, identity) }
  });
  for (const cookie of refreshResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
