"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { PlusCircle, Loader2, Calendar, Users, Plus, Target } from "lucide-react";
import Link from "next/link";

interface Campaign {
  id: string;
  status?: string;
  createdAt?: { toMillis: () => number };
  name?: string;
  budget?: number | string;
}

interface Audience {
  id: string;
  name?: string;
  description?: string;
  size: number;
}

export default function CampaignsPage() {
  const { user } = useAuth();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"campaigns" | "audience">("campaigns");

  // Campaigns State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Audiences State
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loadingAudiences, setLoadingAudiences] = useState(true);
  
  // Audience Form State
  const [audName, setAudName] = useState("");
  const [audDescription, setAudDescription] = useState("");
  const [audSize, setAudSize] = useState("");
  const [isSubmittingAudience, setIsSubmittingAudience] = useState(false);

  // Set active tab based on query param on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "audience") {
        setTimeout(() => {
          setActiveTab("audience");
        }, 0);
      }
    }
  }, []);

  // Fetch campaigns when user is available
  useEffect(() => {
    if (!user) return;
    let active = true;
    
    const fetchCampaigns = async () => {
      try {
        const q = query(collection(db, "campaigns"), where("marketerId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        
        data.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
        
        if (active) {
          setCampaigns(data);
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error);
      } finally {
        if (active) {
          setLoadingCampaigns(false);
        }
      }
    };

    fetchCampaigns();
    return () => {
      active = false;
    };
  }, [user]);

  // Fetch audiences when user is available
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
        }
      } catch (error) {
        console.error("Error fetching audiences:", error);
      } finally {
        if (active) {
          setLoadingAudiences(false);
        }
      }
    };

    fetchAudiences();
    return () => {
      active = false;
    };
  }, [user]);

  // Create Audience Segment Handler
  const handleCreateAudience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmittingAudience(true);
    try {
      const sizeNum = parseInt(audSize) || 0;
      const docRef = await addDoc(collection(db, "audiences"), {
        marketerId: user.uid,
        name: audName,
        description: audDescription,
        size: sizeNum,
        createdAt: serverTimestamp()
      });
      
      const newSegment: Audience = {
        id: docRef.id,
        name: audName,
        description: audDescription,
        size: sizeNum,
      };
      
      setAudName("");
      setAudDescription("");
      setAudSize("");
      setAudiences(prev => [newSegment, ...prev]);
    } catch (error) {
      console.error("Error creating audience segment:", error);
    } finally {
      setIsSubmittingAudience(false);
    }
  };

  return (
    <div>
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaign & Audience Hub</h1>
          <p className="text-gray-500 mt-1">Manage marketing campaigns and target audience segments in one place.</p>
        </div>
        
        {activeTab === "campaigns" ? (
          <Link 
            href="/marketer/campaigns/new"
            className="flex items-center justify-center gap-2 bg-black text-white dark:bg-white dark:text-black px-4 py-2.5 rounded-md font-medium hover:opacity-90 transition-opacity self-start md:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            New Campaign
          </Link>
        ) : null}
      </header>

      {/* Dynamic Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-8">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === "campaigns"
              ? "border-black text-black dark:border-white dark:text-white"
              : "border-transparent text-gray-500 hover:text-black dark:hover:text-white"
          }`}
        >
          <Target className="w-4 h-4" />
          Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab("audience")}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === "audience"
              ? "border-black text-black dark:border-white dark:text-white"
              : "border-transparent text-gray-500 hover:text-black dark:hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          Audience Segments ({audiences.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "campaigns" ? (
        <div>
          {loadingCampaigns ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
              <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No campaigns found</h3>
              <p className="text-gray-500 mt-1 mb-6">You haven&apos;t created any campaigns yet.</p>
              <Link 
                href="/marketer/campaigns/new"
                className="inline-flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Create your first campaign
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-6 py-3 font-medium">Campaign Name</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Budget</th>
                    <th className="px-6 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-4 font-medium">{campaign.name}</td>
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
                      <td className="px-6 py-4">${Number(campaign.budget).toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {campaign.createdAt ? new Date(campaign.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Audience Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800 sticky top-8">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                New Segment
              </h2>
              <form onSubmit={handleCreateAudience} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Segment Name</label>
                  <input
                    type="text"
                    value={audName}
                    onChange={(e) => setAudName(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm"
                    placeholder="e.g. Gen Z Gamers"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    value={audDescription}
                    onChange={(e) => setAudDescription(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white h-24 resize-none text-sm"
                    placeholder="Targeting users aged 18-24 interested in gaming."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Estimated Size</label>
                  <input
                    type="number"
                    value={audSize}
                    onChange={(e) => setAudSize(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm"
                    placeholder="150000"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingAudience}
                  className="w-full bg-black text-white dark:bg-white dark:text-black py-2.5 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                >
                  {isSubmittingAudience && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Segment
                </button>
              </form>
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
            {loadingAudiences ? (
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
                  <div key={audience.id} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-black dark:hover:border-white transition-colors flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="font-bold text-base leading-tight text-gray-900 dark:text-gray-100">{audience.name}</h3>
                        <span className="bg-gray-100 text-gray-800 dark:bg-zinc-900 dark:text-gray-300 text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0">
                          {audience.size.toLocaleString()} users
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm line-clamp-3 mt-2">{audience.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
