import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function generateToken(prefix: string) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, 1, I
  let result = prefix;
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { withdrawalId } = await request.json();

    if (!withdrawalId) {
      return NextResponse.json({ error: "Withdrawal ID is required" }, { status: 400 });
    }

    // 1. Fetch withdrawal request
    const { data: requestData, error: requestError } = await supabase
      .from("withdrawal_requests")
      .select("id, status, student_id")
      .eq("id", withdrawalId)
      .eq("student_id", user.id)
      .single();

    if (requestError || !requestData) {
      return NextResponse.json({ error: "Withdrawal request not found or unauthorized" }, { status: 404 });
    }

    // 2. Validate state
    if (requestData.status !== "approved" && requestData.status !== "token_issued") {
      return NextResponse.json({ error: "Withdrawal request is not in a redeemable state" }, { status: 400 });
    }

    // 3. Fetch token prefix from settings based on user's school
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();
      
    let prefix = "PAY-";
    if (profile?.school_id) {
      const { data: setting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("school_id", profile.school_id)
        .eq("key", "payout_token_prefix")
        .maybeSingle();
      if (setting?.value) {
        prefix = setting.value;
      }
    }

    // 4. Generate token and set expiry (+24 hours)
    const token = generateToken(prefix);
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);

    // 4. Update the DB using Service Role Key (bypassing RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error: Missing service role key" }, { status: 500 });
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { error: updateError } = await adminClient
      .from("withdrawal_requests")
      .update({
        status: "token_issued",
        token_code: token,
        token_issued_at: new Date().toISOString(),
        token_expires_at: expiry.toISOString()
      })
      .eq("id", withdrawalId)
      .eq("student_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to issue token: " + updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      token,
      expires_at: expiry.toISOString()
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error: " + err.message }, { status: 500 });
  }
}
