"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, PieChart, DollarSign, FileText, Bell, LogOut } from "lucide-react";
import { auth, db } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", "admin"),
      where("read", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const navItems = [
    { name: "Analytics", href: "/admin", icon: PieChart },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Budget", href: "/admin/budget", icon: DollarSign },
    { name: "Reports", href: "/admin/reports", icon: FileText },
    { name: "Notifications", href: "/admin/notifications", icon: Bell },
  ];

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="flex h-screen bg-white dark:bg-black text-black dark:text-white">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold tracking-tight">Market Pulse</h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Admin Panel</p>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </div>
                  {item.name === "Notifications" && unreadCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950">
          <div className="p-8 max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
