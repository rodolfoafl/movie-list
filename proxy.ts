import { NextResponse } from "next/server";

import { auth } from "@/app/lib/auth";

const PUBLIC_ROUTES = ["/login"];

export const proxy = auth((req) => {
  const isAuthenticated = !!req.auth?.user;
  const isPublicRoute = PUBLIC_ROUTES.includes(req.nextUrl.pathname);

  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
