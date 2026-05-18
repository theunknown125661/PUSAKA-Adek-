import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=No+authorization+code+received+from+Google`);
  }

  try {
    const supabase = await createClient();
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(sessionError.message)}`);
    }

    // Fetch user profile to redirect to correct dashboard
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.redirect(`${origin}/login?error=Failed+to+retrieve+authenticated+user+session`);
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // If profile query fails (e.g. trigger delays or fails), default to student role
    const role = profile?.role || "student";
    
    // Redirect to dashboard
    return NextResponse.redirect(`${origin}/${role}`);
  } catch (err: any) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(err.message || "An unexpected OAuth callback error occurred")}`);
  }
}
