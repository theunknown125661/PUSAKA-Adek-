import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { token, reason, method = "manual" } = await request.json();

    if (!token || !reason) {
      return NextResponse.json({ error: "Token and reason are required" }, { status: 400 });
    }

    // Fetch withdrawal request
    const { data: reqData, error: reqError } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("token_code", token)
      .single();

    if (reqError || !reqData) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    const withdrawal = reqData as any;

    if (withdrawal.status === "redeemed") {
      return NextResponse.json({ error: "Cannot reject an already redeemed payout." }, { status: 400 });
    }

    // Update Withdrawal Request
    const { error: updateError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: "rejected",
        admin_note: reason,
        processed_at: new Date().toISOString()
      })
      .eq("id", withdrawal.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update withdrawal status" }, { status: 500 });
    }

    // Log the rejection
    await supabase.from("payout_redemption_logs").insert({
      withdrawal_request_id: withdrawal.id,
      student_id: withdrawal.student_id,
      admin_id: user.id,
      attempt_type: method,
      token_entered: token,
      result: "forbidden",
      device_info: `Rejected: ${reason}`
    });

    return NextResponse.json({ success: true, message: "Payout rejected." });

  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error: " + err.message }, { status: 500 });
  }
}
