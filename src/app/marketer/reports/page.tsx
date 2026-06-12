"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { UploadCloud, Loader2, FileUp } from "lucide-react";

export default function ReportsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [campaignId, setCampaignId] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch active/approved campaigns for this marketer
      const cQ = query(
        collection(db, "campaigns"), 
        where("marketerId", "==", user?.uid),
        where("status", "==", "Active")
      );
      const cSnap = await getDocs(cQ);
      const cData = cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCampaigns(cData);
      if (cData.length > 0) setCampaignId(cData[0].id);

      // Fetch past reports
      const rQ = query(collection(db, "reports"), where("marketerId", "==", user?.uid));
      const rSnap = await getDocs(rQ);
      const rData = rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      rData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setReports(rData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !campaignId || !file) return;
    
    setIsSubmitting(true);
    try {
      // 1. Upload File
      const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          setIsSubmitting(false);
        },
        async () => {
          // 2. Get Download URL and Save to Firestore
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          await addDoc(collection(db, "reports"), {
            marketerId: user.uid,
            campaignId,
            content,
            fileUrl: downloadURL,
            fileName: file.name,
            status: "Submitted",
            createdAt: serverTimestamp()
          });

          // Reset
          setContent("");
          setFile(null);
          setUploadProgress(0);
          fetchData(); // refresh list
          setIsSubmitting(false);
        }
      );
    } catch (error) {
      console.error("Error submitting report:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-gray-500 mt-1">Submit performance reports and documents for your active campaigns.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800 sticky top-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UploadCloud className="w-5 h-5" />
              Submit Report
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Campaign</label>
                {campaigns.length === 0 ? (
                  <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    No active campaigns available. You must have an approved "Active" campaign to submit a report.
                  </div>
                ) : (
                  <select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    required
                  >
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Executive Summary</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white h-24 resize-none"
                  placeholder="Summarize the performance..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Document Attachment</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-black hover:file:bg-gray-200 dark:file:bg-zinc-800 dark:file:text-white transition-colors"
                  required
                />
              </div>

              {isSubmitting && uploadProgress > 0 && (
                <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-2.5 mt-2">
                  <div className="bg-black dark:bg-white h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || campaigns.length === 0 || !file}
                className="w-full bg-black text-white dark:bg-white dark:text-black py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {isSubmitting ? "Uploading..." : "Submit Report"}
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
          ) : reports.length === 0 ? (
            <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
              <FileUp className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No reports submitted</h3>
              <p className="text-gray-500 mt-1">Your submitted campaign reports will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">
                        {campaigns.find(c => c.id === report.campaignId)?.name || "Campaign"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Submitted on {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      report.status === 'Reviewed' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{report.content}</p>
                  <a 
                    href={report.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <FileUp className="w-4 h-4" />
                    View Attachment ({report.fileName})
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
