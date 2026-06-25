"use client";

import { useState, useEffect } from "react";
import { app, db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getFirestore } from "firebase/firestore";
import { Users, Loader2, UserPlus, ShieldBan, CheckCircle } from "lucide-react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from "firebase/auth";

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

  // Creation form states
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "marketer"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      // Sort by creation date descending if available
      data.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAction = async (userId: string, currentStatus: string | undefined, newStatus: "active" | "suspended") => {
    const actionText = newStatus === "suspended"
      ? "suspend this marketer? They will lose access to their account immediately."
      : "activate this marketer's account?";
    if (!window.confirm(`Are you sure you want to ${actionText}`)) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        status: newStatus
      });

      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error(`Error updating user status to ${newStatus}:`, error);
      alert("Failed to update user status.");
    }
  };

  const handleCreateMarketer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    setCreateSuccess("");

    const tempAppName = `temp-app-${Date.now()}`;
    let tempApp;
    try {
      // 1. Initialize secondary Firebase app reusing the primary app options
      tempApp = initializeApp(app.options, tempAppName);
      const tempAuth = getAuth(tempApp);
      const tempDb = getFirestore(tempApp);

      // 2. Create the user authentication record in secondary app
      const userCredential = await createUserWithEmailAndPassword(tempAuth, newEmail, newPassword);
      const newUser = userCredential.user;

      // 3. Create the user profile in Firestore using the secondary app db (authenticated as the new user)
      await setDoc(doc(tempDb, "users", newUser.uid), {
        name: newName,
        email: newEmail,
        role: "marketer",
        status: "active",
        createdAt: new Date().toISOString(),
      });

      // 4. Sign out the temporary app session
      await secondarySignOut(tempAuth);

      // 5. Add to local state list so it appears in the table immediately
      const addedUser: User = {
        id: newUser.uid,
        name: newName,
        email: newEmail,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      setUsers((prev) => [addedUser, ...prev]);

      setCreateSuccess("Marketer account created successfully!");
      setNewName("");
      setNewEmail("");
      setNewPassword("");

      setTimeout(() => {
        setCreateSuccess("");
      }, 3000);

    } catch (err: any) {
      console.error("Error creating marketer account:", err);
      if (err.code === "auth/email-already-in-use") {
        setCreateError("This email address is already registered in the system.");
      } else if (err.code === "auth/invalid-email") {
        setCreateError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setCreateError("The password is too weak. It must be at least 6 characters.");
      } else {
        setCreateError(err.message || "Failed to create marketer account.");
      }
    } finally {
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (cleanupErr) {
          console.error("Error deleting temp app:", cleanupErr);
        }
      }
      setCreateLoading(false);
    }
  };

  return (
    <div>
      {/* Header Container */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-gray-500 mt-1">Manage marketer accounts, control access, and create new ones.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            No marketers found
          </h3>
          <p className="text-gray-500 mt-1">
            Add a marketer account below to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Joined</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                {users.map((user) => {
                  const isActive = user.status === "active" || !user.status;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{user.name || "N/A"}</td>
                      <td className="px-6 py-4 text-gray-550">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                          }`}>
                          {isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleAction(user.id, user.status, isActive ? 'suspended' : 'active')}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border ${isActive
                              ? 'text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900/30 dark:hover:bg-red-950/20'
                              : 'text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900/30 dark:hover:bg-green-950/20'
                            }`}
                        >
                          {isActive ? (
                            <><ShieldBan className="w-3.5 h-3.5" /> Suspend</>
                          ) : (
                            <><CheckCircle className="w-3.5 h-3.5" /> Activate</>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inline Add Marketer Form Section */}
      <div className="mt-10 bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-indigo-500" />
          Add New Marketer
        </h2>

        <form onSubmit={handleCreateMarketer} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5" htmlFor="marketerName">
                Full Name
              </label>
              <input
                id="marketerName"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white transition-all text-black dark:text-white"
                placeholder="John Doe"
                required
                disabled={createLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5" htmlFor="marketerEmail">
                Email Address
              </label>
              <input
                id="marketerEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white transition-all text-black dark:text-white"
                placeholder="john.doe@example.com"
                required
                disabled={createLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5" htmlFor="marketerPassword">
                Default Password
              </label>
              <input
                id="marketerPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white transition-all text-black dark:text-white"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={createLoading}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
            <div className="flex-1">
              {createError && (
                <p className="text-red-500 text-xs font-medium leading-relaxed bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg max-w-xl">{createError}</p>
              )}
              {createSuccess && (
                <p className="text-green-500 text-xs font-medium leading-relaxed bg-green-50 dark:bg-green-950/20 p-2.5 rounded-lg max-w-xl">{createSuccess}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={createLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer self-end sm:self-auto min-w-[150px]"
            >
              {createLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Marketer"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
