const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|curl|wget|python|headless/i;

// Which requests may create an anonymous Supabase user: real page visits only.
export function shouldStartGuest(pathname: string, userAgent: string | null): boolean {
  if (pathname.startsWith("/api/") || pathname === "/unavailable") return false;
  if (!userAgent || BOT.test(userAgent)) return false;
  return true;
}
