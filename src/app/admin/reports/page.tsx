"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { FileText, Loader2, Check, FileUp, Printer, X } from "lucide-react";

interface Report {
  id: string;
  status?: string;
  createdAt?: { toMillis: () => number };
  campaignId?: string;
  activityId?: string;
  activityType?: string;
  activityName?: string;
  marketerId: string;
  marketerEmail?: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  deleteRequested?: boolean;
  deleteReason?: string;
  activityDetails?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export default function AdminReportsPage() {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [campaigns, setCampaigns] = useState<{ [key: string]: string }>({});
  const [activities, setActivities] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Print Modal State
  const [selectedReportForPrint, setSelectedReportForPrint] = useState<Report | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Consolidated Summary Report State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const summaryPrintAreaRef = useRef<HTMLDivElement>(null);

  // Filtering State
  const [selectedMonth, setSelectedMonth] = useState<string>("All");

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        // 1. Fetch Campaigns to map IDs to Names (legacy fallback)
        const cSnap = await getDocs(collection(db, "campaigns"));
        const cmap: { [key: string]: string } = {};
        cSnap.docs.forEach(doc => {
          cmap[doc.id] = doc.data().name;
        });
        if (active) {
          setCampaigns(cmap);
        }

        // 2. Fetch Activities to map IDs to Names (new fallback)
        const actSnap = await getDocs(collection(db, "marketer_activities"));
        const actmap: { [key: string]: string } = {};
        actSnap.docs.forEach(doc => {
          const data = doc.data();
          const primaryName = data.institutionName || data.hospitalName || data.conferenceName || data.hospitalOrInstitutionName || "Activity";
          actmap[doc.id] = `${data.activityType} - ${primaryName}`;
        });
        if (active) {
          setActivities(actmap);
        }

        // 3. Fetch Reports
        const rSnap = await getDocs(collection(db, "reports"));
        const rData = rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report))
          .filter(r => r.status === "Submitted" || r.status === "Reviewed");

        // Sort: Submitted first, then by date
        rData.sort((a, b) => {
          const aStatus = a.status || "";
          const bStatus = b.status || "";
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;

          if (aStatus === "Submitted" && bStatus !== "Submitted") return -1;
          if (aStatus !== "Submitted" && bStatus === "Submitted") return 1;
          return bTime - aTime;
        });

        if (active) {
          setReports(rData);
        }
      } catch (error) {
        console.error("Error fetching reports:", error);
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
  }, []);

  const getReportTargetName = (report: Report) => {
    if (report.activityName) {
      return `${report.activityType} - ${report.activityName}`;
    }
    if (report.activityId && activities[report.activityId]) {
      return activities[report.activityId];
    }
    if (report.campaignId && campaigns[report.campaignId]) {
      return `Campaign: ${campaigns[report.campaignId]}`;
    }
    return "Unknown Activity/Campaign";
  };

  const handleMarkReviewed = async (reportId: string, marketerId: string, targetName: string) => {
    setProcessingId(reportId);
    try {
      // 1. Update Status
      await updateDoc(doc(db, "reports", reportId), {
        status: "Reviewed"
      });

      // 2. Notify marketer
      await addDoc(collection(db, "notifications"), {
        userId: marketerId,
        title: "Report Reviewed",
        message: `Your report for "${targetName}" has been reviewed by an administrator.`,
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

  const handleApproveDelete = async (reportId: string, marketerId: string, targetName: string) => {
    if (!window.confirm(`Are you sure you want to approve deletion of the report "${targetName}"? This will permanently delete the report document from the database.`)) return;
    setProcessingId(reportId);
    try {
      // 1. Delete Doc
      await deleteDoc(doc(db, "reports", reportId));

      // 2. Notify marketer
      await addDoc(collection(db, "notifications"), {
        userId: marketerId,
        title: "Report Deletion Approved",
        message: `Your request to delete the report for "${targetName}" has been approved by the administrator.`,
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. Local update
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error("Error approving report deletion:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectDelete = async (reportId: string, marketerId: string, targetName: string) => {
    if (!window.confirm(`Are you sure you want to reject the deletion request for "${targetName}"?`)) return;
    setProcessingId(reportId);
    try {
      // 1. Reset deleteRequested
      await updateDoc(doc(db, "reports", reportId), {
        deleteRequested: false,
        deleteReason: ""
      });

      // 2. Notify marketer
      await addDoc(collection(db, "notifications"), {
        userId: marketerId,
        title: "Report Deletion Rejected",
        message: `Your request to delete the report for "${targetName}" has been rejected by the administrator.`,
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. Local update
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, deleteRequested: false, deleteReason: "" } : r));
    } catch (error) {
      console.error("Error rejecting report deletion:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      const printContents = printAreaRef.current?.innerHTML;

      if (printContents) {
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

  const triggerPrintModal = (report: Report) => {
    setSelectedReportForPrint(report);
    setIsPrintModalOpen(true);
  };

  const getUniqueMonths = () => {
    const months = new Set<string>();
    reports.forEach(r => {
      if (r.createdAt) {
        const date = new Date(r.createdAt.toMillis());
        const label = date.toLocaleString("en-US", { month: "long", year: "numeric" });
        months.add(label);
      }
    });
    return Array.from(months).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
  };

  const getFilteredReports = () => {
    if (selectedMonth === "All") return reports;
    return reports.filter(r => {
      if (!r.createdAt) return false;
      const date = new Date(r.createdAt.toMillis());
      const label = date.toLocaleString("en-US", { month: "long", year: "numeric" });
      return label === selectedMonth;
    });
  };

  const handlePrintSummary = () => {
    if (typeof window !== "undefined") {
      const printContents = summaryPrintAreaRef.current?.innerHTML;

      if (printContents) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Consolidated Marketer Reports Summary</title>
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111; line-height: 1.5; }
                  .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px; }
                  .title { font-size: 24px; font-weight: bold; margin: 0; text-transform: uppercase; }
                  .subtitle { font-size: 13px; color: #555; margin-top: 5px; }
                  .stats-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                  .stat-card { border: 1px solid #ddd; padding: 12px; border-radius: 6px; text-align: center; }
                  .stat-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; }
                  .stat-value { font-size: 18px; font-weight: bold; margin-top: 3px; }
                  .table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
                  .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                  .table th { background-color: #f5f5f5; font-weight: bold; }
                  .report-content { font-size: 11px; color: #444; margin-top: 5px; font-style: italic; }
                  .detail-box { border: 1px solid #eee; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 12px; }
                  .detail-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px; }
                  @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
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
      <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Report Review</h1>
          <p className="text-gray-500 mt-1">Review performance reports submitted by marketers.</p>
        </div>
        {getFilteredReports().length > 0 && (
          <button
            onClick={() => setIsSummaryModalOpen(true)}
            className="inline-flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity self-start sm:self-auto"
          >
            <Printer className="w-4 h-4" />
            Generate Full Summary Report
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No reports found</h3>
          <p className="text-gray-500 mt-1">Marketers haven&apos;t submitted any reports yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end items-center gap-2 bg-gray-50 dark:bg-zinc-900/30 p-3 rounded-lg border border-gray-200 dark:border-gray-800 mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter by Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            >
              <option value="All">All Months (Whole Report)</option>
              {getUniqueMonths().map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {getFilteredReports().length === 0 ? (
            <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center animate-fade-in">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No reports found for {selectedMonth}</h3>
              <p className="text-gray-500 mt-1 font-medium text-sm">There are no marketer reports submitted in {selectedMonth}.</p>
            </div>
          ) : (
            getFilteredReports().map((report) => {
              const targetName = getReportTargetName(report);
              return (
                <div key={report.id} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                        {targetName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Submitted on {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${report.status === 'Reviewed'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                        {report.status}
                      </span>
                      {report.deleteRequested && (
                        <span className="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 text-xs px-2.5 py-0.5 rounded border border-red-200 dark:border-red-900/30 font-semibold animate-pulse">
                          ⚠️ Delete Requested
                        </span>
                      )}

                      {report.deleteRequested ? (
                        <div className="flex flex-col items-end gap-1.5 mt-2">
                          <button
                            onClick={() => handleApproveDelete(report.id, report.marketerId, targetName)}
                            disabled={processingId === report.id}
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-650 hover:text-red-800 dark:text-red-400 dark:hover:text-red-355 disabled:opacity-50"
                          >
                            Approve Delete
                          </button>
                          <button
                            onClick={() => handleRejectDelete(report.id, report.marketerId, targetName)}
                            disabled={processingId === report.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black dark:hover:text-white disabled:opacity-50"
                          >
                            Reject Delete Request
                          </button>
                        </div>
                      ) : (
                        report.status === 'Submitted' && (
                          <button
                            onClick={() => handleMarkReviewed(report.id, report.marketerId, targetName)}
                            disabled={processingId === report.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-2 disabled:opacity-50"
                          >
                            {processingId === report.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Mark as Reviewed
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  
                  {report.deleteRequested && report.deleteReason && (
                    <div className="mb-4 p-4 bg-red-50/50 dark:bg-red-950/10 rounded-lg border border-red-150 dark:border-red-900/30 text-xs">
                      <span className="font-bold text-red-500 uppercase tracking-wider text-[10px] block mb-1">Reason for Deletion Request:</span>
                      <p className="text-gray-700 dark:text-gray-350 italic font-medium">&ldquo;{report.deleteReason}&rdquo;</p>
                    </div>
                  )}
                  
                  {report.activityDetails && (
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-lg border border-gray-150 dark:border-gray-800 text-xs space-y-2">
                      <p className="font-bold text-gray-500 dark:text-gray-450 uppercase tracking-wider text-[10px]">Logged Activity Parameters</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {report.activityDetails.location && (
                          <div>
                            <span className="font-semibold text-gray-400">Location:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.location}</span>
                          </div>
                        )}
                        {report.activityDetails.date && (
                          <div>
                            <span className="font-semibold text-gray-400">Activity Date:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.date}</span>
                          </div>
                        )}
                        {report.activityDetails.costOfVisit !== undefined && (
                          <div>
                            <span className="font-semibold text-gray-400">Cost:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">₹{Number(report.activityDetails.costOfVisit).toLocaleString()}</span>
                          </div>
                        )}

                        {report.activityDetails.headOfInstitute && (
                          <div>
                            <span className="font-semibold text-gray-400">Head of Institute:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.headOfInstitute} {report.activityDetails.headContact && `(${report.activityDetails.headContact})`}</span>
                          </div>
                        )}
                        {report.activityDetails.spocName && (
                          <div>
                            <span className="font-semibold text-gray-400">SPOC:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.spocName} {report.activityDetails.spocContact && `(${report.activityDetails.spocContact})`}</span>
                          </div>
                        )}
                        {report.activityDetails.finalYearStudents !== undefined && (
                          <div>
                            <span className="font-semibold text-gray-400">Students Count:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.finalYearStudents}</span>
                          </div>
                        )}
                        {report.activityDetails.bedsCount !== undefined && (
                          <div>
                            <span className="font-semibold text-gray-400">Beds:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.bedsCount}</span>
                          </div>
                        )}
                        {report.activityDetails.employeesCount !== undefined && (
                          <div>
                            <span className="font-semibold text-gray-400">Employees:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.employeesCount}</span>
                          </div>
                        )}
                        {report.activityDetails.headOfHospital && (
                          <div>
                            <span className="font-semibold text-gray-400">Head of Hospital:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.headOfHospital} {report.activityDetails.contact && `(${report.activityDetails.contact})`}</span>
                          </div>
                        )}
                        {report.activityDetails.modeOfMeeting && (
                          <div>
                            <span className="font-semibold text-gray-400">Meeting Mode:</span>{" "}
                            <span className="text-gray-700 dark:text-gray-300">{report.activityDetails.modeOfMeeting}</span>
                          </div>
                        )}
                      </div>

                      {(report.activityDetails.marketingObservation || report.activityDetails.clientFeedback || report.activityDetails.studentsCapturedList) && (
                        <div className="pt-2 border-t border-dashed border-gray-250 dark:border-gray-800 space-y-1.5">
                          {report.activityDetails.clientFeedback && (
                            <div>
                              <span className="font-semibold text-gray-500">Client Feedback:</span>{" "}
                              <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.activityDetails.clientFeedback}</span>
                            </div>
                          )}
                          {report.activityDetails.marketingObservation && (
                            <div>
                              <span className="font-semibold text-gray-500">Marketing Observations:</span>{" "}
                              <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.activityDetails.marketingObservation}</span>
                            </div>
                          )}
                          {report.activityDetails.studentsCapturedList && (
                            <div>
                              <span className="font-semibold text-gray-500">Students Captured List:</span>{" "}
                              <span className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.activityDetails.studentsCapturedList}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Executive Summary</h4>
                    <p className="text-gray-650 dark:text-gray-400 text-sm bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-md whitespace-pre-wrap">
                      {report.content}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100 dark:border-gray-900">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => triggerPrintModal(report)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Preview / Download PDF
                      </button>
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
              );
            })
          )}
        </div>
      )}

      {/* PRINT PREVIEW DIALOG MODAL */}
      {isPrintModalOpen && selectedReportForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-gray-250 dark:border-gray-800 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-black">

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
                const details = selectedReportForPrint.activityDetails || {};
                return (
                  <div className="max-w-2xl mx-auto space-y-6 text-black bg-white p-6 rounded-md">
                    {/* Document Header */}
                    <div className="border-b-2 border-black pb-4 flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-extrabold uppercase tracking-tight text-black">Activity Performance Report</h2>
                        <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Logged by Marketer: {selectedReportForPrint.marketerEmail || "Unknown Marketer"}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500 font-medium">
                        <div>REPORT ID: #{selectedReportForPrint.id.toUpperCase().substring(0, 8)}</div>
                        <div>DATE: {selectedReportForPrint.createdAt ? new Date(selectedReportForPrint.createdAt.toMillis()).toLocaleDateString() : 'Just now'}</div>
                      </div>
                    </div>

                    {/* Section 1: Activity Classification */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-250 pb-1 mb-3">Activity Information</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-gray-500">Activity Classification</div>
                          <div className="font-bold text-black text-base mt-0.5">{selectedReportForPrint.activityType || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-gray-500">Institution/Hospital Name</div>
                          <div className="font-bold text-black text-base mt-0.5">{selectedReportForPrint.activityName || "N/A"}</div>
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
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-250 pb-1 mb-3">Logged Details & Parameters</h4>
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
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-250 pb-1 mb-3">Observations from Activity Log</h4>
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
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-250 pb-1 mb-3">Report Executive Summary</h4>
                      <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm text-black whitespace-pre-wrap leading-relaxed">
                        {selectedReportForPrint.content}
                      </div>
                    </div>

                    {/* Section 5: Signature Blocks */}
                    <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs">
                      <div>
                        <div className="border-t border-black pt-2 mx-auto w-48 font-semibold uppercase text-black">Marketer Signature</div>
                        <div className="text-[10px] text-gray-400 mt-1">{selectedReportForPrint.marketerEmail || selectedReportForPrint.marketerId}</div>
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

      {/* SUMMARY REPORT PREVIEW DIALOG MODAL */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-gray-250 dark:border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-black">

            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">Consolidated Summary Report</h3>
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Printable Document Preview Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-100 dark:bg-zinc-900" ref={summaryPrintAreaRef}>
              <div className="max-w-3xl mx-auto space-y-6 text-black bg-white p-8 rounded-md shadow-sm">

                {/* Document Header */}
                <div className="border-b-2 border-black pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-extrabold uppercase tracking-tight text-black">Consolidated Marketer Activity Report</h2>
                    <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">
                      Generated by Administrator {selectedMonth !== "All" && `• ${selectedMonth}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500 font-medium">
                    <div>DATE: {new Date().toLocaleDateString()}</div>
                    <div>TOTAL REPORTS: {getFilteredReports().length}</div>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="border border-gray-200 p-3 rounded-md">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Reports</span>
                    <h3 className="text-xl font-bold mt-1 text-black">{getFilteredReports().length}</h3>
                  </div>
                  <div className="border border-gray-200 p-3 rounded-md">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reviewed</span>
                    <h3 className="text-xl font-bold mt-1 text-black">
                      {getFilteredReports().filter(r => r.status === "Reviewed").length}
                    </h3>
                  </div>
                  <div className="border border-gray-200 p-3 rounded-md">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Budget Used</span>
                    <h3 className="text-xl font-bold mt-1 text-black">
                      ₹{getFilteredReports().reduce((sum, r) => sum + (Number(r.activityDetails?.costOfVisit) || 0), 0).toLocaleString()}
                    </h3>
                  </div>
                  <div className="border border-gray-200 p-3 rounded-md">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Marketers</span>
                    <h3 className="text-xl font-bold mt-1 text-black">
                      {new Set(getFilteredReports().map(r => r.marketerEmail || r.marketerId)).size}
                    </h3>
                  </div>
                </div>

                {/* Main Table */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-250 pb-1 mb-3">Submitted Marketer Reports</h4>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold">
                        <th className="p-2 border">Date</th>
                        <th className="p-2 border">Marketer</th>
                        <th className="p-2 border">Activity / Institution</th>
                        <th className="p-2 border">Cost</th>
                        <th className="p-2 border">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredReports().map((report) => (
                        <tr key={report.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 border font-medium">
                            {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                          </td>
                          <td className="p-2 border font-medium">
                            {report.marketerEmail || "Unknown"}
                          </td>
                          <td className="p-2 border">
                            <span className="font-semibold">{report.activityType}</span>
                            <br />
                            <span className="text-gray-500">{report.activityName}</span>
                          </td>
                          <td className="p-2 border font-semibold">
                            ₹{Number(report.activityDetails?.costOfVisit || 0).toLocaleString()}
                          </td>
                          <td className="p-2 border">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${report.status === "Reviewed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-750"
                              }`}>
                              {report.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Details Section (Overview of Content summaries) */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-250 pb-1 mb-3">Report Details & Summary Logs</h4>
                  <div className="space-y-4">
                    {getFilteredReports().map((report, idx) => (
                      <div key={report.id} className="text-xs space-y-1 p-3 border border-gray-100 rounded-md">
                        <div className="flex justify-between font-bold text-gray-850">
                          <span>#{idx + 1}. {report.activityType} - {report.activityName}</span>
                          <span className="text-gray-500 font-normal">By: {report.marketerEmail}</span>
                        </div>
                        <p className="text-gray-650 italic mt-1 bg-gray-50 p-2 rounded">
                          &ldquo;{report.content?.substring(0, 300)}{report.content && report.content.length > 300 ? '...' : ''}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-gray-250 dark:border-gray-800 bg-gray-50 dark:bg-zinc-900/50 flex justify-end gap-3">
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-150 dark:hover:bg-zinc-900 rounded-lg text-sm font-semibold transition-colors"
              >
                Close Preview
              </button>
              <button
                onClick={handlePrintSummary}
                className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Summary Report
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
