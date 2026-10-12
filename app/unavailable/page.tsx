import Link from "next/link";

export default function UnavailablePage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16 space-y-4">
      <h1 className="text-2xl font-semibold">PrepDesk demo</h1>
      <p>We couldn&apos;t start a demo session right now. This can happen after many visits from one network.</p>
      <Link href="/new" className="inline-block rounded bg-blue-700 px-4 py-2 text-white">Try again</Link>
    </main>
  );
}
