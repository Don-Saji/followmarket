"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, updateDoc, doc } from "firebase/firestore";
import { Bell, Loader2, CheckCircle2 } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const q = query(
        collection(db, "notifications"), 
        where("userId", "==", user?.uid)
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort client-side
      data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error("Error updating notification:", error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-gray-500 mt-1">Updates on your campaigns, reports, and budgets.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">You're all caught up!</h3>
          <p className="text-gray-500 mt-1">You have no new notifications right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`p-6 rounded-lg border transition-colors flex gap-4 ${
                notification.read 
                  ? 'bg-gray-50 border-gray-100 dark:bg-zinc-900/30 dark:border-zinc-800 opacity-70' 
                  : 'bg-white border-gray-200 dark:bg-black dark:border-gray-700 shadow-sm'
              }`}
            >
              <div className="mt-1 flex-shrink-0">
                <Bell className={`w-5 h-5 ${notification.read ? 'text-gray-400' : 'text-black dark:text-white'}`} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className={`font-bold ${notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-black dark:text-white'}`}>
                    {notification.title}
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">
                    {notification.createdAt ? new Date(notification.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 mb-3">
                  {notification.message}
                </p>
                {!notification.read && (
                  <button 
                    onClick={() => markAsRead(notification.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Mark as read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
