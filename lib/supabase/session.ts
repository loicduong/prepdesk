import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { shouldStartGuest } from "@/lib/guest";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  if (!data.user && shouldStartGuest(request.nextUrl.pathname, request.headers.get("user-agent"))) {
    // Cookies set here reach both the response and this request's server components.
    const { error } = await supabase.auth.signInAnonymously();
    if (error) console.warn(JSON.stringify({ event: "guest_sign_in_failed", status: error.status ?? null }));
  }
  return response;
}
