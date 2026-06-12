"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { DollarSign, Loader2, Save } from "lucide-react";

export default function AdminBudgetPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "marketer"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudget = async (userId: string) => {
    setIsSaving(true);
    try {
      const numericBudget = parseFloat(editValue) || 0;
      await updateDoc(doc(db, "users", userId), {
        budgetAllocated: numericBudget
      });
      setUsers(users.map(u => u.id === userId ? { ...u, budgetAllocated: numericBudget } : u));
      setEditingId(null);
    } catch (error) {
      console.error("Error updating budget:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Budget Management</h1>
        <p className="text-gray-500 mt-1">Allocate and manage budgets for your marketers.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No marketers found</h3>
          <p className="text-gray-500 mt-1">You can allocate budgets once marketers register.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 font-medium">Marketer</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Allocated Budget</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{user.name || "N/A"}</td>
                  <td className="px-6 py-4 text-gray-500">{user.email}</td>
                  <td className="px-6 py-4">
                    {editingId === user.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 border border-gray-200 dark:border-gray-800 bg-transparent px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="font-medium">
                        ${(user.budgetAllocated || 0).toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingId === user.id ? (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingId(null)}
                          className="text-xs font-medium text-gray-500 hover:text-black dark:hover:text-white"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleSaveBudget(user.id)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setEditingId(user.id);
                          setEditValue((user.budgetAllocated || 0).toString());
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Adjust Budget
                      </button>
                    )}
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
