"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { FileText, Loader2, Check, FileUp, Eye, X } from "lucide-react";

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

const ACTIVITY_TYPES = [
  "Meetings with Institutes",
  "Follow up with Institutes",
  "Campaigns Conducted",
  "Participation in Conferences",
  "Meetings with Hospitals",
  "Follow up with Hospitals"
];

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
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedActivityType, setSelectedActivityType] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

        // 3. Fetch Profiles
        const pSnap = await getDocs(collection(db, "entity_profiles"));
        const pData: Record<string, any> = {};
        pSnap.docs.forEach(doc => {
          pData[doc.id] = doc.data();
        });

        // 4. Fetch Reports
        const rSnap = await getDocs(collection(db, "reports"));
        const rData = rSnap.docs.map(doc => {
          const r = { id: doc.id, ...doc.data() } as Report;
          // Merge profile details if profileId exists
          if (r.activityDetails && r.activityDetails.profileId && pData[r.activityDetails.profileId]) {
            const profile = pData[r.activityDetails.profileId];
            if (profile && profile.details) {
              r.activityDetails = {
                ...profile.details,
                ...r.activityDetails
              };
            }
          }
          return r;
        }).filter(r => r.status === "Submitted" || r.status === "Reviewed");

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



  const triggerPrintModal = (report: Report) => {
    setSelectedReportForPrint(report);
    setIsPrintModalOpen(true);
  };

  const getFilteredReports = () => {
    let result = reports;
    if (startDate) {
      const start = new Date(startDate);
      const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      result = result.filter(r => {
        if (!r.createdAt) return false;
        const reportDate = new Date(r.createdAt.toMillis());
        const reportTime = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate()).getTime();
        return reportTime >= startTime;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      result = result.filter(r => {
        if (!r.createdAt) return false;
        const reportDate = new Date(r.createdAt.toMillis());
        const reportTime = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate()).getTime();
        return reportTime <= endTime;
      });
    }
    if (selectedActivityType !== "All") {
      result = result.filter(r => r.activityType === selectedActivityType);
    }
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const name = (r.activityName || "").toLowerCase();
        const type = (r.activityType || "").toLowerCase();
        const email = (r.marketerEmail || "").toLowerCase();
        const loc = (r.activityDetails?.location || "").toLowerCase();
        const spoc = (r.activityDetails?.spocName || "").toLowerCase();
        const content = (r.content || "").toLowerCase();
        return name.includes(query) ||
          type.includes(query) ||
          email.includes(query) ||
          loc.includes(query) ||
          spoc.includes(query) ||
          content.includes(query);
      });
    }
    return result;
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setSelectedActivityType("All");
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
            className="inline-flex items-center gap-2 bg-blue-600 text-white dark:bg-white dark:text-black px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 dark:hover:opacity-90 transition-colors self-start sm:self-auto"
          >
            <Eye className="w-4 h-4" />
            View Consolidated Summary
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
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-gray-50 dark:bg-zinc-900/30 p-4 rounded-xl border border-gray-200 dark:border-gray-800 mb-2 shadow-xs">
            {/* Search Input */}
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by keyword, marketer, location..."
                className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white transition-all placeholder:text-gray-400"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                </svg>
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selectors and Reset Button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type:</span>
                <select
                  value={selectedActivityType}
                  onChange={(e) => setSelectedActivityType(e.target.value)}
                  className="border border-gray-200 dark:border-gray-800 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 px-2.5 py-2 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white max-w-[150px] truncate cursor-pointer"
                >
                  <option value="All">All Types</option>
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Start:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-gray-200 dark:border-gray-800 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">End:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-gray-200 dark:border-gray-800 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 px-2.5 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white cursor-pointer"
                />
              </div>

              {(searchQuery || startDate || endDate || selectedActivityType !== "All") && (
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {getFilteredReports().length === 0 ? (
            <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center animate-fade-in">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No reports found</h3>
              <p className="text-gray-500 mt-1 font-medium text-sm">There are no submitted marketer reports matching the selected filters.</p>
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
                  {/* Removed Executive Summary block */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100 dark:border-gray-900">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => triggerPrintModal(report)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Preview
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-zinc-100">

            {/* Modal Header */}
            <div className="flex items-center px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-350">
                Report Preview
              </h3>
            </div>

            {/* Scrollable Printable Document Preview Area - PDF Canvas */}
            <div className="flex-1 overflow-y-auto p-8 bg-zinc-800/40" ref={printAreaRef}>
              {(() => {
                const details = selectedReportForPrint.activityDetails || {};
                return (
                  <div
                    className="w-full max-w-[760px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-zinc-200 rounded-sm p-12 mx-auto space-y-8 text-left"
                    style={{ backgroundColor: '#ffffff', color: '#18181b', minHeight: '800px' }}
                  >
                    {/* Document Header */}
                    <div className="border-b-2 border-zinc-900 pb-5 flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Activity Performance Report</h2>
                        <p className="text-xs text-zinc-550 mt-1.5 uppercase font-bold tracking-wider">Logged by Marketer: {selectedReportForPrint.marketerEmail || "Unknown Marketer"}</p>
                      </div>
                      <div className="text-right text-xs text-zinc-500 font-bold tracking-tight">
                        <div className="text-zinc-900">REPORT ID: #{selectedReportForPrint.id.toUpperCase().substring(0, 12)}</div>
                        <div className="mt-1 text-zinc-500">DATE: {selectedReportForPrint.createdAt ? new Date(selectedReportForPrint.createdAt.toMillis()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : 'Just now'}</div>
                      </div>
                    </div>

                    {/* Section 1: Activity Classification */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 pb-1">Activity Information</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Activity Classification</div>
                          <div className="font-extrabold text-zinc-900 text-base mt-1">{selectedReportForPrint.activityType || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Institution/Hospital Name</div>
                          <div className="font-extrabold text-zinc-900 text-base mt-1">{selectedReportForPrint.activityName || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Location</div>
                          <div className="font-semibold text-zinc-800 mt-1">{details.location || "N/A"}</div>
                        </div>
                        {details.date && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Date of Meeting/Visit</div>
                            <div className="font-semibold text-zinc-800 mt-1">{details.date}</div>
                          </div>
                        )}
                        {details.costOfVisit !== undefined && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Cost of Visit</div>
                            <div className="font-bold text-zinc-900 text-base mt-1">₹{Number(details.costOfVisit).toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Specific Activity Custom Fields */}
                    {Object.keys(details).length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 pb-1">Logged Details & Parameters</h4>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">

                          {/* Institute meeting/followup details */}
                          {details.headOfInstitute && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Head of Institute</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.headOfInstitute} {details.headContact && `(${details.headContact})`}</div>
                            </div>
                          )}
                          {details.spocName && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">SPOC Info</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.spocName} {details.spocContact && `(${details.spocContact})`}</div>
                              {details.spocEmail && <div className="text-xs text-zinc-500 mt-0.5">{details.spocEmail}</div>}
                            </div>
                          )}
                          {details.finalYearStudents !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Number of Final Year Students</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.finalYearStudents}</div>
                            </div>
                          )}

                          {/* Campaign details */}
                          {details.studentsAttended !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Students Attended</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.studentsAttended}</div>
                            </div>
                          )}
                          {details.studentsRegistered !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Students Registered</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.studentsRegistered}</div>
                            </div>
                          )}

                          {/* Conference details */}
                          {details.targetProfessionals && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Target Professionals</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.targetProfessionals}</div>
                            </div>
                          )}
                          {details.conferenceParticipants !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Conference Participants</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.conferenceParticipants}</div>
                            </div>
                          )}
                          {details.footfalls !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Footfalls</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.footfalls}</div>
                            </div>
                          )}
                          {details.registrationsCount !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Conference Registrations</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.registrationsCount}</div>
                            </div>
                          )}

                          {/* Hospital details */}
                          {details.headOfHospital && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Head of Hospital</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.headOfHospital} {details.contact && `(${details.contact})`}</div>
                            </div>
                          )}
                          {details.headOfHR && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Head of HR</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.headOfHR} {details.hrContact && `(${details.hrContact})`}</div>
                              {details.hrEmail && <div className="text-xs text-zinc-500 mt-0.5">{details.hrEmail}</div>}
                            </div>
                          )}
                          {details.bedsCount !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Hospital Beds</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.bedsCount}</div>
                            </div>
                          )}
                          {details.employeesCount !== undefined && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Hospital Employees</div>
                              <div className="font-bold text-zinc-900 mt-1">{details.employeesCount}</div>
                            </div>
                          )}

                          {/* Shared details */}
                          {details.modeOfMeeting && (
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Mode of Meeting</div>
                              <div className="font-semibold text-zinc-800 mt-1">{details.modeOfMeeting}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 3: Client Feedback & Observations from Activity */}
                    {(details.clientFeedback || details.marketingObservation || details.studentsCapturedList) && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 pb-1">Observations from Activity Log</h4>
                        <div className="space-y-4 text-sm">
                          {details.clientFeedback && (
                            <div className="bg-zinc-50 p-4 rounded-md border border-zinc-150">
                              <span className="font-bold text-zinc-850 block mb-1 text-[11px] uppercase tracking-wider">Client Feedback:</span>
                              <p className="text-zinc-800 whitespace-pre-wrap leading-relaxed">{details.clientFeedback}</p>
                            </div>
                          )}
                          {details.marketingObservation && (
                            <div className="bg-zinc-50 p-4 rounded-md border border-zinc-150">
                              <span className="font-bold text-zinc-850 block mb-1 text-[11px] uppercase tracking-wider">Marketing Observations:</span>
                              <p className="text-zinc-800 whitespace-pre-wrap leading-relaxed">{details.marketingObservation}</p>
                            </div>
                          )}
                          {details.studentsCapturedList && (
                            <div className="bg-zinc-50 p-4 rounded-md border border-zinc-150">
                              <span className="font-bold text-zinc-850 block mb-1 text-[11px] uppercase tracking-wider">Captured Students List:</span>
                              <p className="text-zinc-800 whitespace-pre-wrap leading-relaxed font-mono text-xs">{details.studentsCapturedList}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 4: Attached Documentation/Media */}
                    {selectedReportForPrint.fileUrl && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 pb-1">
                          Attached Documentation / Media
                        </h4>
                        {(() => {
                          const fileName = selectedReportForPrint.fileName || "";
                          const fileUrl = selectedReportForPrint.fileUrl;
                          const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName) || fileUrl.includes(".jpg") || fileUrl.includes(".png") || fileUrl.includes(".jpeg") || fileUrl.includes(".webp");

                          if (isImage) {
                            return (
                              <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 flex flex-col items-center justify-center gap-2">
                                <div className="text-[10px] text-zinc-450 uppercase font-bold tracking-wider self-start">
                                  Image Attachment Preview ({fileName || "Attachment"})
                                </div>
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" title="View full size image" className="group relative block overflow-hidden rounded border border-zinc-200 bg-white">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={fileUrl}
                                    alt={fileName || "Attachment"}
                                    className="max-h-[250px] w-auto object-contain mx-auto transition-transform hover:scale-[1.02] duration-300"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                    <span className="bg-black/60 text-white text-[11px] px-2.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                                      Open Full Image ↗
                                    </span>
                                  </div>
                                </a>
                              </div>
                            );
                          } else {
                            return (
                              <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-red-50 text-red-650 rounded-lg border border-red-100 flex-shrink-0">
                                    <FileText className="w-6 h-6" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-zinc-900 truncate">
                                      {fileName || "Attached Document"}
                                    </p>
                                    <p className="text-xs text-zinc-550 font-medium">
                                      Click to view or download the attached document
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white px-3.5 py-2 rounded-lg transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                                >
                                  View Document ↗
                                </a>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}

                    {/* Section 5: Signature Blocks */}
                    <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs border-t border-dashed border-zinc-200">
                      <div>
                        <div className="border-t border-zinc-900 pt-2 mx-auto w-48 font-bold uppercase text-zinc-900">Marketer Signature</div>
                        <div className="text-[10px] text-zinc-500 mt-1.5">{selectedReportForPrint.marketerEmail || selectedReportForPrint.marketerId}</div>
                      </div>
                      <div>
                        <div className="border-t border-zinc-900 pt-2 mx-auto w-48 font-bold uppercase text-zinc-900">Admin Approval Signature</div>
                        <div className="text-[10px] text-zinc-550 mt-1.5">Status: <span className="font-bold text-zinc-800">{selectedReportForPrint.status}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white border border-zinc-700 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SUMMARY REPORT PREVIEW DIALOG MODAL */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-zinc-100">

            {/* Summary Viewer Toolbar */}
            <div className="flex justify-between items-center px-6 py-3 border-b border-zinc-800 bg-zinc-950/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-zinc-350 tracking-wide truncate max-w-[200px] sm:max-w-[300px]">
                  Consolidated Activity Summary
                </span>
                <span className="hidden sm:inline-flex items-center bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider">
                  Read Only Preview
                </span>
              </div>

              {/* Mock Controls */}
              <div className="hidden md:flex items-center gap-6 text-zinc-400">
                <div className="flex items-center gap-2 bg-zinc-800/80 px-2.5 py-1 rounded-md border border-zinc-700/50 text-xs">
                  <span>Page 1 of 1</span>
                </div>
                <div className="flex items-center gap-3 select-none text-xs">
                  <span className="cursor-not-allowed hover:text-zinc-200">-</span>
                  <span className="font-medium bg-zinc-800/40 px-2 py-0.5 rounded">100%</span>
                  <span className="cursor-not-allowed hover:text-zinc-200">+</span>
                </div>
              </div>
            </div>

            {/* Scrollable Printable Document Preview Area - PDF Canvas */}
            <div className="flex-1 overflow-y-auto p-8 bg-zinc-800/40" ref={summaryPrintAreaRef}>
              <div
                className="w-full max-w-[760px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-zinc-200 rounded-sm p-12 mx-auto space-y-8 text-left"
                style={{ backgroundColor: '#ffffff', color: '#18181b', minHeight: '800px' }}
              >

                {/* Document Header */}
                <div className="border-b-2 border-zinc-900 pb-5 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Consolidated Marketer Activity Report</h2>
                    <p className="text-xs text-zinc-550 mt-1.5 uppercase font-bold tracking-wider">
                      Generated by Administrator {(startDate || endDate) && `• ${startDate ? startDate : 'Start'} to ${endDate ? endDate : 'Present'}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-zinc-550 font-bold tracking-tight">
                    <div className="text-zinc-900">DATE: {new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="mt-1">TOTAL REPORTS: {getFilteredReports().length}</div>
                  </div>
                </div>

                {/* Statistics Cards - Styled inside document */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="border border-zinc-200 p-3.5 rounded-md bg-zinc-50/50">
                    <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest block">Total Reports</span>
                    <h3 className="text-lg font-black mt-1 text-zinc-900">{getFilteredReports().length}</h3>
                  </div>
                  <div className="border border-zinc-200 p-3.5 rounded-md bg-zinc-50/50">
                    <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest block">Reviewed</span>
                    <h3 className="text-lg font-black mt-1 text-zinc-900">
                      {getFilteredReports().filter(r => r.status === "Reviewed").length}
                    </h3>
                  </div>
                  <div className="border border-zinc-200 p-3.5 rounded-md bg-zinc-50/50">
                    <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest block">Total Budget Used</span>
                    <h3 className="text-lg font-black mt-1 text-zinc-900">
                      ₹{getFilteredReports().reduce((sum, r) => sum + (Number(r.activityDetails?.costOfVisit) || 0), 0).toLocaleString()}
                    </h3>
                  </div>
                  <div className="border border-zinc-200 p-3.5 rounded-md bg-zinc-50/50">
                    <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest block">Active Marketers</span>
                    <h3 className="text-lg font-black mt-1 text-zinc-900">
                      {new Set(getFilteredReports().map(r => r.marketerEmail || r.marketerId)).size}
                    </h3>
                  </div>
                </div>

                {/* Main Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 pb-1">Submitted Marketer Reports</h4>
                  <table className="w-full text-left border-collapse text-xs border border-zinc-250">
                    <thead>
                      <tr className="bg-zinc-100 text-zinc-800 font-extrabold border-b border-zinc-250">
                        <th className="p-2.5 border-r border-zinc-250">Date</th>
                        <th className="p-2.5 border-r border-zinc-250">Marketer</th>
                        <th className="p-2.5 border-r border-zinc-250">Activity / Institution</th>
                        <th className="p-2.5 border-r border-zinc-250 text-right">Cost</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredReports().map((report) => (
                        <tr key={report.id} className="border-b border-zinc-200 hover:bg-zinc-50/50">
                          <td className="p-2.5 border-r border-zinc-200 font-semibold text-zinc-700">
                            {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' }) : 'Just now'}
                          </td>
                          <td className="p-2.5 border-r border-zinc-200 font-medium text-zinc-700">
                            {report.marketerEmail || "Unknown"}
                          </td>
                          <td className="p-2.5 border-r border-zinc-200">
                            <span className="font-bold text-zinc-900">{report.activityType}</span>
                            <br />
                            <span className="text-zinc-500 text-[10px] font-semibold">{report.activityName}</span>
                          </td>
                          <td className="p-2.5 border-r border-zinc-200 font-bold text-zinc-900 text-right">
                            ₹{Number(report.activityDetails?.costOfVisit || 0).toLocaleString()}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${report.status === "Reviewed" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"
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
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 pb-1">Report Details & Summary Logs</h4>
                  <div className="space-y-4">
                    {getFilteredReports().map((report, idx) => (
                      <div key={report.id} className="text-xs space-y-1.5 p-4 border border-zinc-200 rounded-md bg-zinc-50/30">
                        <div className="flex justify-between font-bold text-zinc-900">
                          <span className="font-extrabold">#{idx + 1}. {report.activityType} - {report.activityName}</span>
                          <span className="text-zinc-550 text-[10px] font-semibold">By: {report.marketerEmail}</span>
                        </div>
                        {report.activityDetails && (
                          <div className="text-zinc-650 mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-semibold">
                            {report.activityDetails.location && (
                              <span><strong className="text-zinc-500 font-bold">Location:</strong> {report.activityDetails.location}</span>
                            )}
                            {report.activityDetails.date && (
                              <span><strong className="text-zinc-500 font-bold">Date:</strong> {report.activityDetails.date}</span>
                            )}
                            {report.activityDetails.costOfVisit !== undefined && (
                              <span><strong className="text-zinc-500 font-bold">Cost:</strong> ₹{Number(report.activityDetails.costOfVisit).toLocaleString()}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
              <button
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white border border-zinc-700 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
