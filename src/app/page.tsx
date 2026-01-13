import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-8">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold tracking-tighter text-slate-900">
          Discord Copilot
        </h1>
        <p className="max-w-2xl text-xl text-slate-600">
          The admin dashboard for configuring your AI-powered Discord bot. Manage system instructions, allowed channels, and conversation memory with ease.
        </p>
        <div>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-transform duration-200 hover:scale-105 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}