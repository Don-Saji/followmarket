"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  Loader2,
  FileText,
  Building2,
  MapPin,
  Calendar,
  IndianRupee,
  Printer,
  X,
  FileUp,
  Clock
} from "lucide-react";
import Link from "next/link";

interface ActivityRecord {
  id: string;
  activityType: string;
  createdAt?: { toMillis: () => number };
  costOfVisit?: number;
  institutionName?: string;
  hospitalName?: string;
  conferenceName?: string;
  hospitalOrInstitutionName?: string;
  location?: string;
  date?: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface Report {
  id: string;
  status?: string;
  createdAt?: { toMillis: () => number };
  updatedAt?: { toMillis: () => number };
  activityId: string;
  activityType: string;
  activityName: string;
  marketerId: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  deleteRequested?: boolean;
  deleteReason?: string;
  activityDetails?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const getTimestamp = () => Date.now();

export default function ReportsPage() {
  const { user } = useAuth();
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Data State
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editReportId, setEditReportId] = useState<string | null>(null);

  // Print Modal State
  const [selectedReportForPrint, setSelectedReportForPrint] = useState<Report | null>(null);
  const [selectedActivityForPrint, setSelectedActivityForPrint] = useState<ActivityRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchData = async () => {
      try {
        // 1. Fetch activities logged by this marketer
        const actQ = query(
          collection(db, "marketer_activities"),
          where("marketerId", "==", user.uid)
        );
        const actSnap = await getDocs(actQ);
        const actData = actSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityRecord));

        // Sort activities by date/created at descending
        actData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });

        if (active) {
          setActivities(actData);
          if (actData.length > 0) setSelectedActivityId(actData[0].id);
        }

        // 2. Fetch past reports
        const repQ = query(
          collection(db, "reports"),
          where("marketerId", "==", user.uid)
        );
        const repSnap = await getDocs(repQ);
        const repData = repSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));

        repData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });

        if (active) {
          setReports(repData);
        }
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [user]);

  // Helper to extract the primary name of the event/place
  const getPrimaryName = (record: ActivityRecord | undefined) => {
    if (!record) return "N/A";
    return (
      record.institutionName ||
      record.hospitalName ||
      record.conferenceName ||
      record.hospitalOrInstitutionName ||
      "N/A"
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const selectedActivity = activities.find(a => a.id === selectedActivityId);

  const handleResetForm = () => {
    setEditReportId(null);
    setContent("");
    setFile(null);
    setUploadProgress(0);
    if (activities.length > 0) {
      setSelectedActivityId(activities[0].id);
    }
  };

  const handleEditReport = (report: Report) => {
    setEditReportId(report.id);
    setSelectedActivityId(report.activityId);
    setContent(report.content || "");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm("Are you sure you want to delete this generated report?")) return;
    try {
      await deleteDoc(doc(db, "reports", reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  const handleSubmitToAdmin = async (reportId: string) => {
    if (!window.confirm("Are you sure you want to submit this report to the admin? Once submitted, you cannot edit or delete it.")) return;
    try {
      const reportObj = reports.find(r => r.id === reportId);
      const targetName = reportObj ? reportObj.activityName : "Logged Activity";

      await updateDoc(doc(db, "reports", reportId), {
        status: "Submitted",
        updatedAt: serverTimestamp()
      });

      // Notify Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: "New Report Submitted",
        message: `Marketer ${user?.email || "a marketer"} has submitted a report for "${targetName}".`,
        read: false,
        createdAt: serverTimestamp()
      });

      setReports(prev => prev.map(r =>
        r.id === reportId
          ? { ...r, status: "Submitted" }
          : r
      ));
    } catch (error) {
      console.error("Error submitting report to admin:", error);
    }
  };

  const handleRequestDelete = async (reportId: string, activityName: string) => {
    const reason = window.prompt("Please enter a reason for requesting deletion of this report:");
    if (reason === null) return; // User cancelled
    if (!reason.trim()) {
      alert("A reason is required to request report deletion.");
      return;
    }

    try {
      await updateDoc(doc(db, "reports", reportId), {
        deleteRequested: true,
        deleteReason: reason.trim(),
        updatedAt: serverTimestamp()
      });

      // Notify Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: "Report Deletion Request",
        message: `Marketer ${user?.email || "a marketer"} is requesting deletion of report for "${activityName}". Reason: "${reason.trim()}"`,
        read: false,
        createdAt: serverTimestamp()
      });

      setReports(prev => prev.map(r =>
        r.id === reportId
          ? { ...r, deleteRequested: true, deleteReason: reason.trim() }
          : r
      ));
    } catch (error) {
      console.error("Error requesting report deletion:", error);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedActivityId || !selectedActivity) return;

    setIsSubmitting(true);
    try {
      const actName = getPrimaryName(selectedActivity);
      const actType = selectedActivity.activityType;

      // Extract details excluding firestore metadata
      const details = { ...selectedActivity } as Record<string, unknown>;
      delete details.id;
      delete details.marketerId;
      delete details.activityType;
      delete details.createdAt;
      delete details.updatedAt;

      const saveToFirestore = async (downloadURL?: string, fileName?: string) => {
        if (editReportId) {
          // Update Mode
          const updateFields: Record<string, any> = { // eslint-disable-line @typescript-eslint/no-explicit-any
            activityId: selectedActivityId,
            activityType: actType,
            activityName: actName,
            content,
            activityDetails: details,
            updatedAt: serverTimestamp()
          };

          if (downloadURL) {
            updateFields.fileUrl = downloadURL;
            updateFields.fileName = fileName || "";
          }

          const docRef = doc(db, "reports", editReportId);
          await updateDoc(docRef, updateFields);

          setReports(prev => prev.map(r =>
            r.id === editReportId
              ? {
                ...r,
                ...updateFields,
                updatedAt: { toMillis: () => Date.now() }
              }
              : r
          ));

          const updatedRep = reports.find(r => r.id === editReportId);
          if (updatedRep) {
            triggerPrintModal({
              ...updatedRep,
              ...updateFields,
              updatedAt: { toMillis: () => Date.now() }
            });
          }

          handleResetForm();
        } else {
          // Create Mode
          const payload = {
            marketerId: user.uid,
            marketerEmail: user.email,
            activityId: selectedActivityId,
            activityType: actType,
            activityName: actName,
            content,
            fileUrl: downloadURL || "",
            fileName: fileName || "",
            status: "Draft",
            activityDetails: details,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          const docRef = await addDoc(collection(db, "reports"), payload);

          const newReport: Report = {
            id: docRef.id,
            ...payload,
            createdAt: { toMillis: () => Date.now() },
            updatedAt: { toMillis: () => Date.now() }
          };

          setReports(prev => [newReport, ...prev]);
          handleResetForm();
          triggerPrintModal(newReport);
        }
      };

      if (file) {
        // Upload file if present
        const storageRef = ref(storage, `reports/${user.uid}/${getTimestamp()}_${file.name}`);
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
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await saveToFirestore(downloadURL, file.name);
          }
        );
      } else {
        await saveToFirestore();
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      setIsSubmitting(false);
    }
  };

  const triggerPrintModal = async (report: Report) => {
    setSelectedReportForPrint(report);

    // Check if the activity details are in state, else fetch
    let act = activities.find(a => a.id === report.activityId);
    if (!act) {
      // Activity might not be in the current user's fetched activities list (if it is archived or old)
      // For now, construct a dummy object from report cached fields
      act = {
        id: report.activityId,
        activityType: report.activityType,
        institutionName: report.activityName
      } as ActivityRecord;
    }
    setSelectedActivityForPrint(act);
    setIsPrintModalOpen(true);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      const printContents = printAreaRef.current?.innerHTML;

      if (printContents) {
        // Create an iframe or temporary window to prevent Next.js layout from breaking on print restore
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Activity Report - ${selectedReportForPrint?.activityName}</title>
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
                  .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                  .title { font-size: 28px; font-weight: bold; margin: 0; }
                  .subtitle { font-size: 14px; color: #555; margin-top: 5px; }
                  .section { margin-bottom: 25px; }
                  .section-title { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; }
                  .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; }
                  .label { font-weight: bold; font-size: 13px; color: #666; }
                  .value { font-size: 14px; margin-bottom: 5px; }
                  .content { background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; white-space: pre-wrap; font-size: 14px; }
                  @media print {
                    body { padding: 0; }
                    .content { background: none; border: none; padding: 0; }
                  }
                </style>
              </head>
              <body>
                ${printContents}
                <script>
                  window.onload = function() { window.print(); window.close(); }
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Activity Reports</h1>
        <p className="text-gray-500 mt-1">Select logged marketer activities and generate official report summaries.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-xl border border-gray-200 dark:border-gray-800 text-center max-w-2xl mx-auto">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No activities logged yet</h3>
          <p className="text-gray-500 mt-1 mb-6">You must log an activity on the dashboard before you can generate a report.</p>
          <Link
            href="/marketer"
            className="inline-flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-5 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go to Activity Logger
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column - Report Creation Form */}
          <div className="lg:col-span-5 h-fit">
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs sticky top-8">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-650 dark:text-gray-400" />
                {editReportId ? "Edit Submitted Report" : "Generate New Report"}
              </h2>

              <form onSubmit={handleSubmitReport} className="space-y-4">

                {/* Select Activity */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    Select Logged Activity <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedActivityId}
                    onChange={(e) => setSelectedActivityId(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm"
                    required
                  >
                    {activities.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.activityType} - {getPrimaryName(act)} ({act.location || "No Location"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Activity Details Card */}
                {selectedActivity && (
                  <div className="p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-lg border border-gray-150 dark:border-gray-800/60 text-xs space-y-2">
                    <p className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[10px]">Activity Preview</p>
                    <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-gray-150 mt-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {getPrimaryName(selectedActivity)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-gray-500 font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedActivity.location || "N/A"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {selectedActivity.date || "No Date"}
                      </span>
                      <span className="flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" />
                        Cost: ₹{Number(selectedActivity.costOfVisit || 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 col-span-2">
                        <Clock className="w-3 h-3" />
                        Logged: {selectedActivity.createdAt ? new Date(selectedActivity.createdAt.toMillis()).toLocaleDateString() : "Just now"}
                      </span>
                    </div>

                    {/* Conditional sub-details */}
                    <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-1">
                      {selectedActivity.spocName && (
                        <div><span className="font-semibold">SPOC:</span> {selectedActivity.spocName} {selectedActivity.spocContact && `(${selectedActivity.spocContact})`}</div>
                      )}
                      {selectedActivity.headOfInstitute && (
                        <div><span className="font-semibold">Head of Institute:</span> {selectedActivity.headOfInstitute}</div>
                      )}
                      {selectedActivity.headOfHospital && (
                        <div><span className="font-semibold">Head of Hospital:</span> {selectedActivity.headOfHospital}</div>
                      )}
                      {selectedActivity.finalYearStudents !== undefined && (
                        <div><span className="font-semibold">Final Year Students:</span> {selectedActivity.finalYearStudents}</div>
                      )}
                      {selectedActivity.bedsCount !== undefined && (
                        <div><span className="font-semibold">Hospital Beds:</span> {selectedActivity.bedsCount}</div>
                      )}
                      {selectedActivity.studentsAttended !== undefined && (
                        <div><span className="font-semibold">Students Attended:</span> {selectedActivity.studentsAttended}</div>
                      )}
                      {selectedActivity.conferenceParticipants !== undefined && (
                        <div><span className="font-semibold">Conference Participants:</span> {selectedActivity.conferenceParticipants}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Executive Summary */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    Report Executive Summary <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white h-32 resize-y text-sm"
                    placeholder="Provide detailed outcomes, meeting achievements, and next actionable steps..."
                    required
                  />
                </div>

                {/* Optional Attachment */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    Document/Photo Attachment <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 dark:file:bg-zinc-800 dark:file:text-white file:text-black hover:file:bg-gray-200 transition-colors"
                  />
                </div>

                {isSubmitting && uploadProgress > 0 && (
                  <div className="w-full bg-gray-250 dark:bg-zinc-800 rounded-full h-2 mt-2">
                    <div className="bg-black dark:bg-white h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}

                <div className="flex gap-2.5 mt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting || activities.length === 0}
                    className="flex-1 bg-black text-white dark:bg-white dark:text-black py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {uploadProgress > 0 ? "Uploading Attachment..." : "Saving..."}
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        {editReportId ? "Update Report" : "Generate & Submit Report"}
                      </>
                    )}
                  </button>
                  {editReportId && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 hover:bg-gray-150 dark:hover:bg-zinc-900 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right Column - Submitted Reports List */}
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
              <h2 className="text-xl font-bold tracking-tight mb-6">Generated Reports</h2>

              {reports.length === 0 ? (
                <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No reports generated yet</h3>
                  <p className="text-gray-500 mt-1">Submit the report form on the left to generate activity summaries.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report.id} className="bg-white dark:bg-zinc-950 p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-350 dark:hover:border-zinc-700 transition-colors">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div>
                          <span className="bg-gray-100 text-gray-700 dark:bg-zinc-900 dark:text-gray-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {report.activityType}
                          </span>
                          <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mt-1.5">
                            {report.activityName}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Generated on {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${report.status === 'Reviewed'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/30'
                          : report.status === 'Submitted'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30'
                            : 'bg-gray-55 text-gray-700 dark:bg-zinc-900 dark:text-gray-300 border-gray-200 dark:border-gray-800'
                          }`}>
                          {report.status || 'Draft'}
                        </span>
                      </div>

                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3 bg-gray-50 dark:bg-zinc-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-900">
                        {report.content}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-900">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => triggerPrintModal(report)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            View / Print PDF
                          </button>

                          {report.status === 'Draft' || !report.status ? (
                            <div className="flex items-center gap-3 border-l border-gray-200 dark:border-gray-855 pl-3">
                              <button
                                onClick={() => handleSubmitToAdmin(report.id)}
                                className="text-xs font-bold text-amber-600 hover:text-amber-750 transition-colors"
                              >
                                Submit to Admin
                              </button>
                              <button
                                onClick={() => handleEditReport(report)}
                                className="text-xs font-semibold text-gray-500 hover:text-black dark:hover:text-white transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteReport(report.id)}
                                className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          ) : report.status === 'Submitted' ? (
                            <div className="flex flex-wrap items-center gap-3 border-l border-gray-200 dark:border-gray-855 pl-3">
                              <span className="text-xs text-amber-500 font-semibold italic">
                                Submitted to Admin
                              </span>
                              {report.deleteRequested ? (
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-[11px] text-red-500 font-semibold italic bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-200/50 dark:border-red-900/30">
                                    Delete Requested
                                  </span>
                                  {report.deleteReason && (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                      Reason: {report.deleteReason}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleRequestDelete(report.id, report.activityName)}
                                  className="text-xs font-semibold text-red-500 hover:text-red-755 transition-colors"
                                >
                                  Request Delete
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3 border-l border-gray-200 dark:border-gray-855 pl-3">
                              <span className="text-xs text-blue-500 font-semibold italic">
                                Reviewed by Admin
                              </span>
                              {report.deleteRequested ? (
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-[11px] text-red-500 font-semibold italic bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-200/50 dark:border-red-900/30">
                                    Delete Requested
                                  </span>
                                  {report.deleteReason && (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                      Reason: {report.deleteReason}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleRequestDelete(report.id, report.activityName)}
                                  className="text-xs font-semibold text-red-500 hover:text-red-755 transition-colors"
                                >
                                  Request Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {report.fileUrl && (
                          <a
                            href={report.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            View Attachment ({report.fileName})
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* PRINT PREVIEW DIALOG MODAL */}
      {isPrintModalOpen && selectedReportForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-gray-250 dark:border-gray-800 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">Report Document Generator</h3>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Printable Document Preview Area */}
            <div className="flex-1 overflow-y-auto p-8" ref={printAreaRef}>
              {(() => {
                const details = selectedReportForPrint.activityDetails || selectedActivityForPrint || {};
                return (
                  <div className="max-w-2xl mx-auto space-y-6 text-black">
                    {/* Document Header */}
                    <div className="border-b-2 border-black pb-4 flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-extrabold uppercase tracking-tight text-black">Activity Performance Report</h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Logged by Marketer: {user?.email || "Unknown Marketer"}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500 font-medium">
                        <div>REPORT ID: #{selectedReportForPrint.id.toUpperCase().substring(0, 8)}</div>
                        <div>DATE: {selectedReportForPrint.createdAt ? new Date(selectedReportForPrint.createdAt.toMillis()).toLocaleDateString() : 'Just now'}</div>
                      </div>
                    </div>

                    {/* Section 1: Activity Classification */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1 mb-3">Activity Information</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-gray-500">Activity Classification</div>
                          <div className="font-bold text-black text-base mt-0.5">{selectedReportForPrint.activityType}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-gray-500">Institution/Hospital Name</div>
                          <div className="font-bold text-black text-base mt-0.5">{selectedReportForPrint.activityName}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-gray-500">Location</div>
                          <div className="font-medium mt-0.5">{details.location || "N/A"}</div>
                        </div>
                        {details.date && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-gray-500">Date of Meeting/Visit</div>
                            <div className="font-medium mt-0.5">{details.date}</div>
                          </div>
                        )}
                        {details.costOfVisit !== undefined && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-gray-500">Cost of Visit</div>
                            <div className="font-medium mt-0.5">₹{Number(details.costOfVisit).toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Specific Activity Custom Fields */}
                    {Object.keys(details).length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1 mb-3">Logged Details & Parameters</h4>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">

                          {/* Institute meeting/followup details */}
                          {details.headOfInstitute && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Head of Institute</div>
                              <div className="font-semibold mt-0.5">{details.headOfInstitute} {details.headContact && `(${details.headContact})`}</div>
                            </div>
                          )}
                          {details.spocName && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">SPOC Info</div>
                              <div className="font-semibold mt-0.5">{details.spocName} {details.spocContact && `(${details.spocContact})`}</div>
                              {details.spocEmail && <div className="text-xs text-gray-500">{details.spocEmail}</div>}
                            </div>
                          )}
                          {details.finalYearStudents !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Number of Final Year Students</div>
                              <div className="font-semibold mt-0.5">{details.finalYearStudents}</div>
                            </div>
                          )}

                          {/* Campaign details */}
                          {details.studentsAttended !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Students Attended</div>
                              <div className="font-semibold mt-0.5">{details.studentsAttended}</div>
                            </div>
                          )}
                          {details.studentsRegistered !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Students Registered</div>
                              <div className="font-semibold mt-0.5">{details.studentsRegistered}</div>
                            </div>
                          )}

                          {/* Conference details */}
                          {details.targetProfessionals && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Target Professionals</div>
                              <div className="font-semibold mt-0.5">{details.targetProfessionals}</div>
                            </div>
                          )}
                          {details.conferenceParticipants !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Conference Participants</div>
                              <div className="font-semibold mt-0.5">{details.conferenceParticipants}</div>
                            </div>
                          )}
                          {details.footfalls !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Footfalls</div>
                              <div className="font-semibold mt-0.5">{details.footfalls}</div>
                            </div>
                          )}
                          {details.registrationsCount !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Conference Registrations</div>
                              <div className="font-semibold mt-0.5">{details.registrationsCount}</div>
                            </div>
                          )}

                          {/* Hospital details */}
                          {details.headOfHospital && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Head of Hospital</div>
                              <div className="font-semibold mt-0.5">{details.headOfHospital} {details.contact && `(${details.contact})`}</div>
                            </div>
                          )}
                          {details.headOfHR && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Head of HR</div>
                              <div className="font-semibold mt-0.5">{details.headOfHR} {details.hrContact && `(${details.hrContact})`}</div>
                              {details.hrEmail && <div className="text-xs text-gray-500">{details.hrEmail}</div>}
                            </div>
                          )}
                          {details.bedsCount !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Hospital Beds</div>
                              <div className="font-semibold mt-0.5">{details.bedsCount}</div>
                            </div>
                          )}
                          {details.employeesCount !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Hospital Employees</div>
                              <div className="font-semibold mt-0.5">{details.employeesCount}</div>
                            </div>
                          )}

                          {/* Shared details */}
                          {details.modeOfMeeting && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-gray-500">Mode of Meeting</div>
                              <div className="font-semibold mt-0.5">{details.modeOfMeeting}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 3: Client Feedback & Observations from Activity */}
                    {(details.clientFeedback || details.marketingObservation || details.studentsCapturedList) && (
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1 mb-3">Observations from Activity Log</h4>
                        <div className="space-y-3 text-sm text-black">
                          {details.clientFeedback && (
                            <div>
                              <span className="font-bold text-gray-650">Client Feedback:</span>
                              <p className="mt-1 text-gray-850 whitespace-pre-wrap">{details.clientFeedback}</p>
                            </div>
                          )}
                          {details.marketingObservation && (
                            <div>
                              <span className="font-bold text-gray-650">Marketing Observations:</span>
                              <p className="mt-1 text-gray-850 whitespace-pre-wrap">{details.marketingObservation}</p>
                            </div>
                          )}
                          {details.studentsCapturedList && (
                            <div>
                              <span className="font-bold text-gray-650">Captured Students List:</span>
                              <p className="mt-1 text-gray-850 whitespace-pre-wrap">{details.studentsCapturedList}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Report Executive Summary */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1 mb-3">Report Executive Summary</h4>
                      <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm text-black whitespace-pre-wrap leading-relaxed">
                        {selectedReportForPrint.content}
                      </div>
                    </div>

                    {/* Section 5: Signature Blocks */}
                    <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs">
                      <div>
                        <div className="border-t border-black pt-2 mx-auto w-48 font-semibold uppercase text-black">Marketer Signature</div>
                        <div className="text-[10px] text-gray-400 mt-1">{user?.email}</div>
                      </div>
                      <div>
                        <div className="border-t border-black pt-2 mx-auto w-48 font-semibold uppercase text-black">Admin Approval Signature</div>
                        <div className="text-[10px] text-gray-400 mt-1">Status: {selectedReportForPrint.status}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900/50 flex justify-end gap-3">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-150 dark:hover:bg-zinc-900 rounded-lg text-sm font-semibold transition-colors"
              >
                Close Preview
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print / Download PDF
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
