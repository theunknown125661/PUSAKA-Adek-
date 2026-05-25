import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { WithdrawalRequest } from "@/lib/types/database";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { token, method = "manual" } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // 2. Fetch withdrawal request by token
    const { data: reqData, error: reqError } = await supabase
      .from("withdrawal_requests")
      .select("*, profiles!student_id(school_id)")
      .eq("token_code", token)
      .single();

    if (reqError || !reqData) {
      // Log invalid attempt if possible, though we don't have request ID
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    const withdrawal = reqData as any;
    const logBase = {
      withdrawal_request_id: withdrawal.id,
      student_id: withdrawal.student_id,
      admin_id: user.id,
      attempt_type: method,
      token_entered: token
    };

    // 3. Validation Rules
    if (withdrawal.status === "redeemed") {
      await supabase.from("payout_redemption_logs").insert({ ...logBase, result: "already_used" });
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }

    if (withdrawal.status !== "token_issued") {
      await supabase.from("payout_redemption_logs").insert({ ...logBase, result: "invalid" });
      return NextResponse.json({ error: "Withdrawal is not ready for redemption" }, { status: 400 });
    }

    if (withdrawal.token_expires_at && new Date(withdrawal.token_expires_at) < new Date()) {
      await supabase.from("withdrawal_requests").update({ status: "expired" }).eq("id", withdrawal.id);
      await supabase.from("payout_redemption_logs").insert({ ...logBase, result: "expired" });
      return NextResponse.json({ error: "Token has expired" }, { status: 400 });
    }

    // 4. Process Redemption
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Missing service role key" }, { status: 500 });
    }
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Deduct from wallet using Service Role Key
    const { data: walletData } = await adminClient
      .from("wallets")
      .select("balance_available")
      .eq("id", withdrawal.wallet_id)
      .single();

    if (!walletData || walletData.balance_available < withdrawal.amount) {
      await adminClient.from("payout_redemption_logs").insert({ ...logBase, result: "invalid" });
      return NextResponse.json({ error: "Student has insufficient wallet balance" }, { status: 400 });
    }

    const { error: walletUpdateError } = await adminClient
      .from("wallets")
      .update({ balance_available: walletData.balance_available - withdrawal.amount })
      .eq("id", withdrawal.wallet_id);

    if (walletUpdateError) {
      return NextResponse.json({ error: "Failed to process wallet transaction" }, { status: 500 });
    }

    // Insert wallet transaction record
    await adminClient.from("wallet_transactions").insert({
      wallet_id: withdrawal.wallet_id,
      user_id: withdrawal.student_id,
      amount: -withdrawal.amount,
      currency_type: "RUPIAH",
      event_type: "withdrawal",
      state: "COMPLETED",
      note: "Payout Redeemed via Token"
    });

    // Update Withdrawal Request
    const { error: updateError } = await adminClient
      .from("withdrawal_requests")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        redeemed_by: user.id,
        redemption_method: method
      })
      .eq("id", withdrawal.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update withdrawal status" }, { status: 500 });
    }

    // Log Success
    await adminClient.from("payout_redemption_logs").insert({ ...logBase, result: "success" });

    return NextResponse.json({ success: true, message: "Payout redeemed successfully" });

  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error: " + err.message }, { status: 500 });
  }
}
