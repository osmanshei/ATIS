import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_SESSION_COOKIE, isAppSessionValid } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasValidAppSession = isAppSessionValid(
    request.cookies.get(APP_SESSION_COOKIE)?.value,
  );

  // Supabase refreshes access tokens in the background. The separate
  // HttpOnly app-session cookie gives ATIS a six-hour absolute session limit.
  if (!isPublic && pathname !== "/" && !hasValidAppSession) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("message", "Your session has expired. Please sign in again.");
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options);
    });
    redirectResponse.cookies.delete(APP_SESSION_COOKIE);
    return redirectResponse;
  }

  const { data } = await supabase.auth.getClaims();
  const userIsAuthenticated = Boolean(data?.claims?.sub);

  if (!userIsAuthenticated && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (userIsAuthenticated && pathname === "/login" && hasValidAppSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (userIsAuthenticated && pathname === "/login" && !hasValidAppSession) {
    await supabase.auth.signOut();
  }

  return response;
}
