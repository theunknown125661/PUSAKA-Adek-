import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const isProduction = process.env.NODE_ENV === "production";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      cookieOptions: {
        secure: isProduction,
        sameSite: "lax",
      }
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes
  if (pathname === "/login" || pathname === "/" || pathname === "/auth/callback") {
    if (user) {
      // Fetch role and redirect
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = `/${profile.role}`;
        return NextResponse.redirect(redirectUrl);
      }
    }
    return supabaseResponse;
  }

  // Protected routes — redirect to login if not authenticated
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role-based route protection
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  if (pathname.startsWith("/student") && role !== "student") {
    const url = request.nextUrl.clone();
    url.pathname = role ? `/${role}` : "/login";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/teacher") && role !== "teacher") {
    const url = request.nextUrl.clone();
    url.pathname = role ? `/${role}` : "/login";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = role ? `/${role}` : "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
