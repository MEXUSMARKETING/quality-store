import { NextResponse, type NextRequest } from "next/server";

/* Passes the requested admin path to server components (the admin layout uses it to
   block pages the signed-in team member has no permission for). */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-admin-path", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/admin/:path*", "/admin"] };
