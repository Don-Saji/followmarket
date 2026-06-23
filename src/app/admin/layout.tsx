"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, PieChart, DollarSign, FileText, Bell, LogOut, Loader2, CheckCircle2, Trash2, X, Settings, Briefcase } from "lucide-react";
import { auth, db } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { collection, query, where, onSnapshot, updateDoc, deleteDoc, doc } from "firebase/firestore";

interface Notification {
  id: string;
  read?: boolean;
  title?: string;
  message?: string;
  createdAt?: { toMillis: () => number };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", "admin")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Notification);
        // Sort client-side
        data.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
        setNotifications(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to admin notifications:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (error) {
      console.error("Error updating admin notification:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (error) {
      console.error("Error deleting admin notification:", error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const promises = unread.map((n) => updateDoc(doc(db, "notifications", n.id), { read: true }));
      await Promise.all(promises);
    } catch (error) {
      console.error("Error marking all admin notifications as read:", error);
    }
  };

  const clearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all notifications?")) return;
    try {
      const promises = notifications.map((n) => deleteDoc(doc(db, "notifications", n.id)));
      await Promise.all(promises);
    } catch (error) {
      console.error("Error clearing admin notifications:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: PieChart },
    { name: "Reports", href: "/admin/reports", icon: FileText },
    { name: "Budget", href: "/admin/budget", icon: DollarSign },
    { name: "Profiles", href: "/admin/profiles", icon: Briefcase },
    { name: "Users", href: "/admin/users", icon: Users },
  ];

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="flex h-screen bg-white dark:bg-black text-black dark:text-white relative overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Market Pulse</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Admin Panel</p>
            </div>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors relative cursor-pointer"
              aria-label="Open admin notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-black">
                  {unreadCount}
                </span>
              )}
            </button>
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
                      ? "bg-blue-600 text-white dark:bg-white dark:text-black"
                      : "text-gray-605 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors text-left cursor-pointer flex-1"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <Link
              href="/admin/settings"
              title="Account Settings"
              className={`p-2 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
                pathname === "/admin/settings"
                  ? "bg-blue-600 text-white dark:bg-white dark:text-black"
                  : "text-gray-650 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900"
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-zinc-950">
          <div className="p-8 max-w-6xl mx-auto">{children}</div>
        </main>

        {/* Notification Drawer Backdrop */}
        <div
          onClick={() => setIsDrawerOpen(false)}
          className={`fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-300 z-45 ${
            isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Notification Sliding Drawer */}
        <div
          className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50">
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </h3>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">{unreadCount} unread message{unreadCount > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors px-2 py-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close admin notifications drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-900">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-zinc-900 flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
                  <Bell className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-200">You&apos;re all caught up!</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[240px] mx-auto">
                  When marketers submit activity reports or request deletions, system alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                  className={`p-5 transition-all flex gap-4 text-left relative group ${
                    notification.read
                      ? "bg-transparent opacity-65 hover:opacity-100"
                      : "bg-blue-50/25 dark:bg-blue-950/10 hover:bg-blue-50/45 dark:hover:bg-blue-950/20 cursor-pointer"
                  }`}
                >
                  {/* Blue Unread Dot */}
                  {!notification.read && (
                    <div className="absolute top-[22px] left-2.5 w-2 h-2 rounded-full bg-blue-500" />
                  )}

                  <div className="flex-1 min-w-0 pl-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`text-sm font-semibold truncate ${
                        notification.read ? "text-gray-600 dark:text-gray-300" : "text-gray-900 dark:text-white"
                      }`}>
                        {notification.title || "Update"}
                      </h4>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap pt-0.5">
                        {notification.createdAt ? new Date(notification.createdAt.toMillis()).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : "Just now"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                      {notification.message}
                    </p>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-black dark:hover:text-white rounded transition-colors cursor-pointer"
                        title="Mark as read"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 flex justify-center bg-gray-50/50 dark:bg-zinc-900/50">
              <button
                onClick={clearAll}
                className="text-xs font-semibold text-red-500 hover:text-red-650 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear all notifications
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
