"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, query, getDocs, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { FileText, Loader2, Check, FileUp } from "lucide-react";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Campaigns to map IDs to Names
      const cSnap = await getDocs(collection(db, "campaigns"));
      const cmap: { [key: string]: string } = {};
      cSnap.docs.forEach(doc => {
        cmap[doc.id] = doc.data().name;
      });
      setCampaigns(cmap);

      // Fetch Reports
      const rSnap = await getDocs(collection(db, "reports"));
      const rData = rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort: Submitted first, then by date
      rData.sort((a, b) => {
        if (a.status === "Submitted" && b.status !== "Submitted") return -1;
        if (a.status !== "Submitted" && b.status === "Submitted") return 1;
        return b.createdAt?.toMillis() - a.createdAt?.toMillis();
      });
      
      setReports(rData);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReviewed = async (reportId: string, marketerId: string, campaignId: string) => {
    setProcessingId(reportId);
    try {
      // 1. Update Status
      await updateDoc(doc(db, "reports", reportId), {
        status: "Reviewed"
      });

      // 2. Notify marketer
      const campaignName = campaigns[campaignId] || "a campaign";
      await addDoc(collection(db, "notifications"), {
        userId: marketerId,
        title: "Report Reviewed",
        message: `Your report for "${campaignName}" has been reviewed by an administrator.`,
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. Local update
      setReports(reports.map(r => r.id === reportId ? { ...r, status: "Reviewed" } : r));
    } catch (error) {
      console.error("Error updating report:", error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Report Review</h1>
        <p className="text-gray-500 mt-1">Review performance reports submitted by marketers.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No reports found</h3>
          <p className="text-gray-500 mt-1">Marketers haven't submitted any reports yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">
                    {campaigns[report.campaignId] || "Unknown Campaign"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Submitted on {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    report.status === 'Reviewed' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {report.status}
                  </span>
                  {report.status === 'Submitted' && (
                    <button 
                      onClick={() => handleMarkReviewed(report.id, report.marketerId, report.campaignId)}
                      disabled={processingId === report.id}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-2 disabled:opacity-50"
                    >
                      {processingId === report.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Mark as Reviewed
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-md">
                {report.content}
              </p>
              <a 
                href={report.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
              >
                <FileUp className="w-4 h-4" />
                View Attached Document ({report.fileName})
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
