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

    // Fetch the withdrawal request
    const { data: withdrawalReq, error: fetchError } = await adminClient
      .from("withdrawal_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !withdrawalReq) {
      return NextResponse.json({ error: "Withdrawal request not found" }, { status: 404 });
    }

    if (withdrawalReq.status !== "pending") {
      return NextResponse.json({ error: "Withdrawal request is already processed" }, { status: 400 });
    }

    if (action === "APPROVED") {
      // In V2, approval simply marks it as approved. Deduction happens upon QR scan/redemption.
      const { error: updateReqError } = await adminClient
        .from("withdrawal_requests")
        .update({
          status: "approved",
          admin_note: note || null,
          processed_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (updateReqError) {
        return NextResponse.json({ error: "Failed to update withdrawal request status: " + updateReqError.message }, { status: 400 });
      }

    } else {
      // Rejection
      const { error: updateReqError } = await adminClient
        .from("withdrawal_requests")
        .update({
          status: "rejected",
          admin_note: note || null,
          processed_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (updateReqError) {
        return NextResponse.json({ error: "Failed to update withdrawal request status: " + updateReqError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Process payout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

