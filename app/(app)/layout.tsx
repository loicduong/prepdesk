import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        <Link href="/new" className="font-semibold">PrepDesk</Link>
        <Link href="/new">New report</Link>
        <Link href="/reports">History</Link>
        <Link href="/billing">Billing</Link>
        <span className="ml-auto text-gray-500">{displayName(user)}</span>
      </nav>
      {children}
    </div>
  );
}
