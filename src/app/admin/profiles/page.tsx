"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { Building2, Search, MapPin, Building, Activity, Calendar, Loader2, ChevronRight, FileText, CheckCircle2, Eye, X } from "lucide-react";
import { useRef } from "react";

interface EntityProfile {
  id: string;
  marketerId: string;
  type: string;
  name: string;
  location: string;
  details: Record<string, any>;
  createdAt?: { toMillis: () => number };
}

interface Report {
  id: string;
  status?: string;
  createdAt?: { toMillis: () => number };
  activityType?: string;
  activityName?: string;
  marketerId: string;
  marketerEmail?: string;
  activityDetails?: Record<string, any>;
}

export default function AdminProfilesPage() {
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Print Modal State
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [selectedReportForPrint, setSelectedReportForPrint] = useState<Report | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const triggerPrintModal = (report: Report) => {
    setSelectedReportForPrint(report);
    setIsPrintModalOpen(true);
  };

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        // Fetch profiles
        const pSnap = await getDocs(collection(db, "entity_profiles"));
        const pData = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityProfile));
        
        pData.sort((a, b) => {
          const aName = a.name || "";
          const bName = b.name || "";
          return aName.localeCompare(bName);
        });

        // Fetch reports
        const rSnap = await getDocs(collection(db, "reports"));
        const rData = rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report))
          .filter(r => r.status === "Submitted" || r.status === "Reviewed");

        if (active) {
          setProfiles(pData);
          setReports(rData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
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

  const getFilteredProfiles = () => {
    let result = profiles;
    if (selectedType !== "All") {
      result = result.filter(p => p.type === selectedType);
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.location.toLowerCase().includes(q)
      );
    }
    return result;
  };

  const filteredProfiles = getFilteredProfiles();
  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
  const profileReports = selectedProfile ? reports.filter(r => r.activityDetails?.profileId === selectedProfile.id).sort((a, b) => {
    const aTime = a.createdAt?.toMillis() || 0;
    const bTime = b.createdAt?.toMillis() || 0;
    return bTime - aTime;
  }) : [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Profiles Directory</h1>
        <p className="text-gray-500 mt-1">Manage and review all registered Institutes and Hospitals.</p>
      </header>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0">
          
          {/* Master List (Left Sidebar) */}
          <div className="w-1/3 flex flex-col bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3 bg-gray-50/50 dark:bg-zinc-900/30">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search profiles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-gray-400"
                />
              </div>
              <div className="flex gap-2">
                {["All", "Institute", "Hospital"].map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                      selectedType === type 
                      ? "bg-gray-900 text-white dark:bg-white dark:text-black" 
                      : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProfiles.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No profiles found.
                </div>
              ) : (
                filteredProfiles.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-colors ${
                      selectedProfileId === profile.id
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50"
                      : "hover:bg-gray-50 dark:hover:bg-zinc-900 border-transparent"
                    } border`}
                  >
                    <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${
                      profile.type === "Hospital" 
                      ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" 
                      : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                    }`}>
                      {profile.type === "Hospital" ? <Activity className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">{profile.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3" /> {profile.location}
                      </p>
                    </div>
                    {selectedProfileId === profile.id && <ChevronRight className="w-4 h-4 text-blue-500 self-center" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detail View (Right Panel) */}
          <div className="flex-1 bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 overflow-y-auto shadow-sm p-8">
            {selectedProfile ? (
              <div className="space-y-8 animate-fade-in">
                
                {/* Profile Header */}
                <div className="flex items-start gap-5 pb-6 border-b border-gray-100 dark:border-gray-800">
                  <div className={`p-4 rounded-xl flex-shrink-0 ${
                    selectedProfile.type === "Hospital" 
                    ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" 
                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                  }`}>
                    {selectedProfile.type === "Hospital" ? <Activity className="w-8 h-8" /> : <Building className="w-8 h-8" />}
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-2">
                      {selectedProfile.type}
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{selectedProfile.name}</h2>
                    <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="w-4 h-4" /> {selectedProfile.location}
                    </p>
                  </div>
                </div>

                {/* Profile Detailed Attributes */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Profile Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedProfile.type === "Institute" && (
                      <>
                        <DetailCard label="Head of Institute" value={selectedProfile.details?.headOfInstitute} />
                        <DetailCard label="Head Contact" value={selectedProfile.details?.headContact} />
                        <DetailCard label="SPOC Name" value={selectedProfile.details?.spocName} />
                        <DetailCard label="SPOC Contact" value={selectedProfile.details?.spocContact} />
                        <DetailCard label="SPOC Email" value={selectedProfile.details?.spocEmail} />
                        <DetailCard label="Final Year Students" value={selectedProfile.details?.finalYearStudents} />
                      </>
                    )}
                    {selectedProfile.type === "Hospital" && (
                      <>
                        <DetailCard label="Head of Hospital" value={selectedProfile.details?.headOfHospital} />
                        <DetailCard label="Head Contact" value={selectedProfile.details?.contact} />
                        <DetailCard label="Head of HR" value={selectedProfile.details?.headOfHR} />
                        <DetailCard label="HR Contact" value={selectedProfile.details?.hrContact} />
                        <DetailCard label="HR Email" value={selectedProfile.details?.hrEmail} />
                        <DetailCard label="Beds Count" value={selectedProfile.details?.bedsCount} />
                        <DetailCard label="Employees Count" value={selectedProfile.details?.employeesCount} />
                      </>
                    )}
                  </div>
                </div>

                {/* Activity History */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Activity History
                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-[10px]">
                      {profileReports.length}
                    </span>
                  </h3>
                  
                  <div className="space-y-3">
                    {profileReports.length === 0 ? (
                      <p className="text-sm text-gray-500 p-4 bg-gray-50 dark:bg-zinc-900/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
                        No activity reports found for this profile.
                      </p>
                    ) : (
                      profileReports.map(report => (
                        <div key={report.id} className="p-4 rounded-lg border border-gray-150 dark:border-gray-800 bg-white dark:bg-black hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-md text-blue-600 dark:text-blue-400">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <h4 className="font-bold text-sm">{report.activityType}</h4>
                            </div>
                            <span className="text-xs text-gray-500 font-medium">
                              {report.createdAt ? new Date(report.createdAt.toMillis()).toLocaleDateString() : 'Unknown Date'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                            <div className="text-gray-600 dark:text-gray-400">
                              <span className="font-semibold">Marketer:</span> {report.marketerEmail || "Unknown"}
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              <span className="font-semibold">Status:</span> 
                              <span className={`ml-1 px-1.5 py-0.5 rounded-full font-semibold text-[10px] ${
                                report.status === "Reviewed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              }`}>{report.status}</span>
                            </div>
                            {report.activityDetails?.modeOfMeeting && (
                              <div className="text-gray-600 dark:text-gray-400">
                                <span className="font-semibold">Mode:</span> {report.activityDetails.modeOfMeeting}
                              </div>
                            )}
                          </div>
                          
                            {report.activityDetails?.clientFeedback && (
                              <div className="mt-3 p-2 bg-gray-50 dark:bg-zinc-900/50 rounded-md text-xs text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-zinc-800">
                                <span className="font-bold text-gray-500 uppercase tracking-wider text-[9px] block mb-0.5">Client Feedback</span>
                                <p className="line-clamp-2">{report.activityDetails.clientFeedback}</p>
                              </div>
                            )}
                            
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => triggerPrintModal(report)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Full Report
                              </button>
                            </div>
                          </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Building2 className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No Profile Selected</h3>
                <p className="text-sm">Select a profile from the sidebar to view details and reports.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRINT PREVIEW DIALOG MODAL */}
      {isPrintModalOpen && selectedReportForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-zinc-100">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-350">
                Report Preview
              </h3>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
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
                          {/* Institute details */}
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
                  </div>
                );
              })()}
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
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

function DetailCard({ label, value, subtext }: { label: string, value: string | number | undefined, subtext?: string }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="p-3 bg-gray-50 dark:bg-zinc-900/40 rounded-lg border border-gray-150 dark:border-gray-800">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</div>
      <div className="font-bold text-sm text-gray-900 dark:text-gray-100">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-0.5">{subtext}</div>}
    </div>
  );
}
