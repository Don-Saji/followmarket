"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { Users, Loader2, ShieldBan, CheckCircle } from "lucide-react";

interface User {
  id: string;
  name?: string;
  email?: string;
  status?: string;
  createdAt?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "marketer"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        if (active) {
          setUsers(data);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchUsers();
    return () => {
      active = false;
    };
  }, []);

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await updateDoc(doc(db, "users", userId), {
        status: newStatus
      });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-gray-500 mt-1">Manage marketer accounts and access.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No marketers found</h3>
          <p className="text-gray-500 mt-1">Users will appear here when they register.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{user.name || "N/A"}</td>
                  <td className="px-6 py-4 text-gray-500">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {user.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => toggleStatus(user.id, user.status || 'active')}
                      className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                        user.status === 'active'
                          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                          : 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                      }`}
                    >
                      {user.status === 'active' ? (
                        <><ShieldBan className="w-3.5 h-3.5" /> Suspend</>
                      ) : (
                        <><CheckCircle className="w-3.5 h-3.5" /> Activate</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
