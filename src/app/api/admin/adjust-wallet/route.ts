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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { studentId, currencyType, available, pending, locked, reason } = body;

    if (!studentId || !currencyType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (currencyType !== "COIN" && currencyType !== "RUPIAH") {
      return NextResponse.json({ error: "Invalid currency type" }, { status: 400 });
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

    // Fetch existing wallet
    const { data: wallet, error: fetchError } = await adminClient
      .from("wallets")
      .select("*")
      .eq("user_id", studentId)
      .eq("currency_type", currencyType)
      .maybeSingle();

    if (!wallet) {
      // Create wallet if it doesn't exist
      const { data: newWallet, error: createError } = await adminClient
        .from("wallets")
        .insert({
          user_id: studentId,
          currency_type: currencyType,
          balance_available: available || 0,
          balance_pending: pending || 0,
          balance_locked: locked || 0
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }

      // Log transaction
      await adminClient.from("wallet_transactions").insert({
        wallet_id: newWallet.id,
        user_id: studentId,
        event_type: "adjustment",
        amount: available || 0,
        currency_type: currencyType,
        state: "RELEASED",
        note: `Admin wallet init: ${reason || "No reason specified"}`
      });

      return NextResponse.json({ success: true });
    }

    // Calculate changes for ledger
    const oldAvailable = wallet.balance_available;
    const diff = (available !== undefined ? available : oldAvailable) - oldAvailable;

    // Update wallet
    const { error: updateError } = await adminClient
      .from("wallets")
      .update({
        balance_available: available !== undefined ? available : wallet.balance_available,
        balance_pending: pending !== undefined ? pending : wallet.balance_pending,
        balance_locked: locked !== undefined ? locked : wallet.balance_locked,
        updated_at: new Date().toISOString()
      })
      .eq("id", wallet.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Log transaction if available balance changed
    if (diff !== 0) {
      await adminClient.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        user_id: studentId,
        event_type: "adjustment",
        amount: diff,
        currency_type: currencyType,
        state: "RELEASED",
        note: `Admin adjustment: ${reason || "No reason specified"}`
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Adjust wallet error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
