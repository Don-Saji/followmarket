"use client";

import { Bell } from "lucide-react";

export default function AdminNotificationsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">System Notifications</h1>
        <p className="text-gray-500 mt-1">Alerts and updates from the platform.</p>
      </header>

      <div className="space-y-4">
        <div className="p-6 rounded-lg border bg-gray-50 border-gray-100 dark:bg-zinc-900/30 dark:border-zinc-800 flex gap-4">
          <div className="mt-1 flex-shrink-0">
            <Bell className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-gray-600 dark:text-gray-400">Welcome to market</h3>
              <span className="text-xs text-gray-500 font-medium">Just now</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 mb-1">
              Your admin dashboard is ready. Marketers can now register, submit campaigns for your approval, and upload performance reports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
