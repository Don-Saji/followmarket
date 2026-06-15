"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, query, getDocs, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { CheckSquare, Loader2, Check, X } from "lucide-react";

interface Campaign {
  id: string;
  status?: string;
  createdAt?: { toMillis: () => number };
  name: string;
  budget?: number | string;
  marketerId: string;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCampaigns = async () => {
      try {
        const q = query(collection(db, "campaigns"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        
        // Sort by status (Pending first) then by date
        data.sort((a, b) => {
          const aStatus = a.status || "";
          const bStatus = b.status || "";
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;

          if (aStatus === "Pending" && bStatus !== "Pending") return -1;
          if (aStatus !== "Pending" && bStatus === "Pending") return 1;
          return bTime - aTime;
        });
        
        if (active) {
          setCampaigns(data);
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchCampaigns();
    return () => {
      active = false;
    };
  }, []);

  const handleStatusUpdate = async (campaignId: string, marketerId: string, campaignName: string, newStatus: "Active" | "Rejected") => {
    setProcessingId(campaignId);
    try {
      // 1. Update Campaign Status
      await updateDoc(doc(db, "campaigns", campaignId), {
        status: newStatus
      });

      // 2. Create a notification for the marketer
      await addDoc(collection(db, "notifications"), {
        userId: marketerId,
        title: `Campaign ${newStatus}`,
        message: `Your campaign "${campaignName}" has been ${newStatus.toLowerCase()} by an administrator.`,
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. Update local state
      setCampaigns(campaigns.map(c => c.id === campaignId ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error("Error updating campaign:", error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Campaign Approvals</h1>
        <p className="text-gray-500 mt-1">Review, approve, or reject proposed marketing campaigns.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <CheckSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No campaigns found</h3>
          <p className="text-gray-500 mt-1">Marketers haven&apos;t proposed any campaigns yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 font-medium">Campaign Name</th>
                <th className="px-6 py-3 font-medium">Proposed Budget</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{campaign.name}</td>
                  <td className="px-6 py-4">${Number(campaign.budget).toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {campaign.createdAt ? new Date(campaign.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      campaign.status === 'Active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : campaign.status === 'Pending'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {campaign.status === 'Pending' ? (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleStatusUpdate(campaign.id, campaign.marketerId, campaign.name, 'Active')}
                          disabled={processingId === campaign.id}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(campaign.id, campaign.marketerId, campaign.name, 'Rejected')}
                          disabled={processingId === campaign.id}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1.5 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Resolved</span>
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
