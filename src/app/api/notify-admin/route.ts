import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify caller is authenticated
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { type, category, priority, title, message, action_url, related_type, related_id } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 3. Update using Service Role Key to bypass RLS and insert admin notifications
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error: Missing service role key" }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Fetch all admin profiles in the system
    const { data: admins, error: fetchAdminsError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (fetchAdminsError || !admins || admins.length === 0) {
      return NextResponse.json({ success: true, warning: "No admin profiles found to notify" });
    }

    // Prepare notifications for all admins
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      actor_id: user.id,
      type,
      category: category || "transactional",
      priority: priority || "low",
      title,
      message,
      action_url: action_url || null,
      related_type: related_type || null,
      related_id: related_id || null,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await adminClient
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Failed to insert admin notifications:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Notify admin error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
