"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Audience {
  id: string;
  name?: string;
  size: number;
}

export default function NewCampaignPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchAudiences = async () => {
      try {
        const q = query(collection(db, "audiences"), where("marketerId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Audience));
        if (active) {
          setAudiences(data);
          if (data.length > 0) {
            setAudienceId(data[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching audiences:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchAudiences();
    return () => {
      active = false;
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !audienceId) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "campaigns"), {
        marketerId: user.uid,
        name,
        budget: parseFloat(budget),
        audienceId,
        status: "Pending", // Campaigns need admin approval
        createdAt: serverTimestamp()
      });
      
      router.push("/marketer/campaigns");
    } catch (error) {
      console.error("Error creating campaign:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8">
        <Link href="/marketer/campaigns" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black dark:hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Campaign</h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="bg-white dark:bg-black p-8 rounded-lg border border-gray-200 dark:border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                placeholder="e.g. Summer Blowout Sale"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Proposed Budget ($)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                placeholder="5000"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Target Audience</label>
              {audiences.length === 0 ? (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  You must create an audience segment first before creating a campaign.
                  <Link href="/marketer/campaigns?tab=audience" className="ml-2 underline font-medium">Create one now</Link>
                </div>
              ) : (
                <select
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  required
                >
                  {audiences.map((aud) => (
                    <option key={aud.id} value={aud.id}>
                      {aud.name} ({aud.size.toLocaleString()} users)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="submit"
                disabled={isSubmitting || audiences.length === 0}
                className="w-full bg-black text-white dark:bg-white dark:text-black py-3 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit for Approval
              </button>
              <p className="text-center text-xs text-gray-500 mt-3">
                All new campaigns require admin approval before going live.
              </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
