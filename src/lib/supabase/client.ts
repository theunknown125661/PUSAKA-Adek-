import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const isProduction = process.env.NODE_ENV === "production";
  
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: isProduction,
        sameSite: "lax",
      }
    }
  );
}
