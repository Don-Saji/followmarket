import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900">
        <div className="font-bold text-xl tracking-tighter">Market Pulse</div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/login"
            className="bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 max-w-3xl">
          The minimal platform for modern marketers.
        </h1>
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl">
          Manage your budget, submit reports, and track your audience with a simple, high-performance dashboard.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-6 py-3 rounded-full font-medium hover:scale-105 transition-transform"
          >
            Start your campaign <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/setup"
            className="flex items-center gap-2 bg-transparent text-gray-500 border border-gray-200 dark:border-gray-800 px-6 py-3 rounded-full font-medium hover:text-black dark:hover:text-white transition-colors"
          >
            Setup Admin
          </Link>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-gray-500 border-t border-gray-100 dark:border-gray-900">
        &copy; {new Date().getFullYear()} Market Pulse. All rights reserved.
      </footer>
    </div>
  );
}
