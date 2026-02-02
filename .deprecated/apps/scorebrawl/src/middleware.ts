import type { Session } from "@/lib/auth";
import { betterFetch } from "@better-fetch/fetch";
import { createAuthClient } from "better-auth/client";
import { type NextRequest, NextResponse } from "next/server";

export const client = createAuthClient();

export default async function (request: NextRequest) {
  try {
    const { data: session } = await betterFetch<Session>("/api/auth/get-session", {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });
    if (!session) {
      return NextResponse.redirect(new URL("/auth/sign-in", request.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }
  return NextResponse.next();
}

/*export const config = {
  matcher: ["/((?!api|static|_next|favicon.ico|favicon-*|auth).*)"],
};*/
export const config = {
  matcher: ["/((?!api|auth|_next/static|_next/image|.*\\.png$|.*\\.jpg$).*)"],
};
