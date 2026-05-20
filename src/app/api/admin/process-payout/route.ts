import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify caller is an admin
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

    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { requestId, action, note } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (action !== "APPROVED" && action !== "REJECTED") {
      return NextResponse.json({ error: "Invalid action. Use APPROVED or REJECTED" }, { status: 400 });
    }

    // 3. Update using Service Role Key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error: Missing service role key" }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Fetch the payout request
    const { data: payoutReq, error: fetchError } = await adminClient
      .from("payout_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !payoutReq) {
      return NextResponse.json({ error: "Payout request not found" }, { status: 404 });
    }

    if (payoutReq.state !== "REQUESTED") {
      return NextResponse.json({ error: "Payout request is already processed" }, { status: 400 });
    }

    const studentId = payoutReq.user_id;
    const amount = payoutReq.amount;

    if (action === "APPROVED") {
      // Fetch student's RUPIAH wallet
      const { data: wallet, error: walletError } = await adminClient
        .from("wallets")
        .select("*")
        .eq("user_id", studentId)
        .eq("currency_type", "RUPIAH")
        .maybeSingle();

      if (walletError || !wallet) {
        return NextResponse.json({ error: "Student's Rupiah wallet not found" }, { status: 404 });
      }

      if (wallet.balance_available < amount) {
        return NextResponse.json({ error: "Insufficient available balance in student's Rupiah wallet" }, { status: 400 });
      }

      // Deduct balance from available
      const { error: updateWalletError } = await adminClient
        .from("wallets")
        .update({
          balance_available: wallet.balance_available - amount,
          updated_at: new Date().toISOString()
        })
        .eq("id", wallet.id);

      if (updateWalletError) {
        return NextResponse.json({ error: "Failed to update wallet balance: " + updateWalletError.message }, { status: 400 });
      }

      // Add ledger transaction
      const { error: txError } = await adminClient
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          user_id: studentId,
          event_type: "payout",
          event_id: requestId,
          amount: -amount, // Negative for debit
          currency_type: "RUPIAH",
          state: "PAID",
          note: `Payout request approved. Destination: ${payoutReq.destination || "cash"}. ${note || ""}`
        });

      if (txError) {
        console.error("Warning: Failed to log transaction in ledger:", txError);
      }

      // Update payout request state
      const { error: updateReqError } = await adminClient
        .from("payout_requests")
        .update({
          state: "PAID", // Payout requests table state maps to PAID when fully processed
          processed_by: adminUser.id,
          processed_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (updateReqError) {
        return NextResponse.json({ error: "Failed to update payout request status: " + updateReqError.message }, { status: 400 });
      }

    } else {
      // Rejection: Just update payout request state to REJECTED
      const { error: updateReqError } = await adminClient
        .from("payout_requests")
        .update({
          state: "REJECTED",
          processed_by: adminUser.id,
          processed_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (updateReqError) {
        return NextResponse.json({ error: "Failed to update payout request status: " + updateReqError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Process payout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
