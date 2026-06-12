"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { Users, Plus, Loader2 } from "lucide-react";

export default function AudiencePage() {
  const { user } = useAuth();
  const [audiences, setAudiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAudiences();
    }
  }, [user]);

  const fetchAudiences = async () => {
    try {
      const q = query(collection(db, "audiences"), where("marketerId", "==", user?.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAudiences(data);
    } catch (error) {
      console.error("Error fetching audiences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "audiences"), {
        marketerId: user.uid,
        name,
        description,
        size: parseInt(size) || 0,
        createdAt: serverTimestamp()
      });
      
      setName("");
      setDescription("");
      setSize("");
      fetchAudiences();
    } catch (error) {
      console.error("Error creating audience:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Audience Management</h1>
        <p className="text-gray-500 mt-1">Define and track your target audience segments.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800 sticky top-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              New Segment
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Segment Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="e.g. Gen Z Gamers"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white h-24 resize-none"
                  placeholder="Targeting users aged 18-24 interested in gaming."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estimated Size</label>
                <input
                  type="number"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="150000"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Segment
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : audiences.length === 0 ? (
            <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No segments yet</h3>
              <p className="text-gray-500 mt-1">Create your first audience segment to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {audiences.map((audience) => (
                <div key={audience.id} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-black dark:hover:border-white transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg">{audience.name}</h3>
                    <span className="bg-gray-100 text-gray-800 dark:bg-zinc-900 dark:text-gray-300 text-xs px-2 py-1 rounded-full font-medium">
                      {audience.size.toLocaleString()} users
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm line-clamp-3">{audience.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
