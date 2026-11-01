import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rewriteAtPath } from "@/website/rules";

/** `/@주소이름` 을 `/site/주소이름` 으로 엽니다. */
export function middleware(request: NextRequest) {
  const nextPath = rewriteAtPath(request.nextUrl.pathname);
  if (!nextPath) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = nextPath;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
