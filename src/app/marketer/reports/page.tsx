"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import {
  Loader2,
  FileText,
  Building2,
  MapPin,
  Calendar,
  IndianRupee,
  Eye,
  X,
  FileUp,
  Plus
} from "lucide-react";

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

const ACTIVITY_TYPES = [
  "Follow up with Institutes",
  "Campaigns Conducted",
  "Participation in Conferences",
  "Follow up with Hospitals"
];

export interface EntityProfile {
  id: string;
  type: "Institute" | "Hospital";
  name: string;
  location: string;
  marketerId: string;
  createdAt?: { toMillis: () => number };
  details: Record<string, any>;
  deleteRequested?: boolean;
  deleteReason?: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Data State
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActivityType, setFilterActivityType] = useState<string>("all");

  // Form State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [activityType, setActivityType] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editReportId, setEditReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Print Modal State
  const [selectedReportForPrint, setSelectedReportForPrint] = useState<Report | null>(null);
  const [selectedActivityForPrint, setSelectedActivityForPrint] = useState<ActivityRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Profile State
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [activeTab, setActiveTab] = useState<"Reports" | "Profiles">("Reports");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileType, setProfileType] = useState<"Institute" | "Hospital" | "">("");
  const [profileFormData, setProfileFormData] = useState<Record<string, any>>({});
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [selectedProfileForView, setSelectedProfileForView] = useState<EntityProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchData = async () => {
      try {
        // Fetch past reports
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

        // Fetch profiles
        const profQ = query(
          collection(db, "entity_profiles"),
          where("marketerId", "==", user.uid)
        );
        const profSnap = await getDocs(profQ);
        const profData = profSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EntityProfile));

        profData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });

        // Merge profile details into past reports for complete viewing
        repData.forEach(r => {
          const details = r.activityDetails;
          if (details && details.profileId) {
            const prof = profData.find(p => p.id === details.profileId);
            if (prof && prof.details) {
              r.activityDetails = {
                ...prof.details,
                ...details
              };
            }
          }
        });

        if (active) {
          setReports(repData);
          setProfiles(profData);
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
  }, [user]);

  // Helper to extract the primary name of the event/place
  const getPrimaryName = (record: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!record) return "N/A";
    return (
      record.profileName ||
      record.institutionName ||
      record.hospitalName ||
      record.conferenceName ||
      record.hospitalOrInstitutionName ||
      "N/A"
    );
  };

  const handleInputChange = (field: string, value: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleActivityTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    setActivityType(type);
    if (!editReportId) {
      setFormData({});
    }
  };

  const selectedActivity = activityType ? ({ activityType, ...formData } as any) : null; // eslint-disable-line @typescript-eslint/no-explicit-any

  const handleResetForm = () => {
    setEditReportId(null);
    setActivityType("");
    setFormData({});
    setErrorMessage(null);
    setIsFormModalOpen(false);
  };

  const handleEditReport = (report: Report) => {
    setEditReportId(report.id);
    setActivityType(report.activityType || "");
    setFormData(report.activityDetails || {});
    setIsFormModalOpen(true);
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

  const handleRequestProfileDelete = async (profileId: string, profileName: string) => {
    const reason = window.prompt("Please enter a reason for requesting deletion of this profile:");
    if (reason === null) return; // User cancelled
    if (!reason.trim()) {
      alert("A reason is required to request profile deletion.");
      return;
    }

    try {
      await updateDoc(doc(db, "entity_profiles", profileId), {
        deleteRequested: true,
        deleteReason: reason.trim(),
        updatedAt: serverTimestamp()
      });

      // Notify Admin
      await addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: "Profile Deletion Request",
        message: `Marketer ${user?.email || "a marketer"} is requesting deletion of profile "${profileName}". Reason: "${reason.trim()}"`,
        read: false,
        createdAt: serverTimestamp()
      });

      setProfiles(prev => prev.map(p =>
        p.id === profileId
          ? { ...p, deleteRequested: true, deleteReason: reason.trim() }
          : p
      ));
      
      // Update the selected profile if it's currently open
      if (selectedProfileForView && selectedProfileForView.id === profileId) {
        setSelectedProfileForView(prev => prev ? { ...prev, deleteRequested: true, deleteReason: reason.trim() } : null);
      }
    } catch (error) {
      console.error("Error requesting profile deletion:", error);
    }
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profileType) return;
    
    setIsSubmittingProfile(true);
    setErrorMessage(null);
    try {
      const name = profileType === "Institute" ? profileFormData.institutionName : profileFormData.hospitalName;
      
      const payload = {
        marketerId: user.uid,
        type: profileType,
        name: name || "Unknown",
        location: profileFormData.location || "Unknown",
        details: profileFormData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "entity_profiles"), payload);
      const newProfile: EntityProfile = {
        id: docRef.id,
        ...payload,
        createdAt: { toMillis: () => Date.now() }
      } as any;

      setProfiles(prev => [newProfile, ...prev]);
      setIsProfileModalOpen(false);
      setProfileType("");
      setProfileFormData({});
    } catch (error: any) {
      console.error("Error creating profile:", error);
      setErrorMessage(error.message || "Failed to create profile.");
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activityType) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const actName = getPrimaryName(formData);
      const actType = activityType;

      // Format numeric input fields before saving
      const formattedData: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
      Object.entries(formData).forEach(([key, val]) => {
        if (val === "" || val === undefined || val === null) return;

        if (
          [
            "costOfVisit",
            "finalYearStudents",
            "studentsAttended",
            "studentsRegistered",
            "conferenceParticipants",
            "footfalls",
            "registrationsCount",
            "bedsCount",
            "employeesCount"
          ].includes(key)
        ) {
          formattedData[key] = parseFloat(val) || 0;
        } else {
          formattedData[key] = val;
        }
      });

      const saveToFirestore = async () => {
        if (editReportId) {
          // Update Mode
          const updateFields: Record<string, any> = { // eslint-disable-line @typescript-eslint/no-explicit-any
            activityType: actType,
            activityName: actName,
            activityDetails: formattedData,
            updatedAt: serverTimestamp()
          };

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
            activityId: `inline_${Date.now()}`,
            activityType: actType,
            activityName: actName,
            fileUrl: "",
            fileName: "",
            status: "Draft",
            activityDetails: formattedData,
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

      await saveToFirestore();
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error("Error submitting report:", error);
      setErrorMessage(error.message || "An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFilteredReports = () => {
    let result = [...reports];
    if (filterActivityType !== "all") {
      result = result.filter(r => r.activityType === filterActivityType);
    }

    result.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });
    return result;
  };

  const triggerPrintModal = async (report: Report) => {
    setSelectedReportForPrint(report);
    setSelectedActivityForPrint(report.activityDetails as ActivityRecord);
    setIsPrintModalOpen(true);
  };





  return (
    <div>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Reports & Profiles</h1>
          <p className="text-gray-500 mt-1">Manage entity profiles and generate official report summaries.</p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setProfileType("");
              setProfileFormData({});
              setIsProfileModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Building2 className="w-4 h-4" />
            Create Profile
          </button>
          
          <button
            onClick={() => {
              handleResetForm();
              setIsFormModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-white dark:text-black px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("Reports")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "Reports" ? "border-blue-600 text-blue-600 dark:border-white dark:text-white" : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"}`}
        >
          Activity Reports
        </button>
        <button
          onClick={() => setActiveTab("Profiles")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "Profiles" ? "border-blue-600 text-blue-600 dark:border-white dark:text-white" : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"}`}
        >
          Entity Profiles
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="w-full">

      {/* REPORT GENERATION / EDIT FORM MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-650 dark:text-gray-400" />
                {editReportId ? "Edit Submitted Report" : "Generate New Report"}
              </h2>
              <button
                type="button"
                onClick={handleResetForm}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitReport} className="flex flex-col flex-1 overflow-hidden">
              {/* Modal Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Select Activity Type */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                    Activity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={activityType}
                    onChange={handleActivityTypeChange}
                    disabled={!!editReportId}
                    className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-white text-sm disabled:opacity-60"
                    required
                  >
                    <option value="">Select Activity Type...</option>
                    {ACTIVITY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Fields Section */}
                {activityType && (
                  <div className="space-y-4 pt-4 border-t border-gray-150 dark:border-gray-800/80 transition-all duration-300">
                    
                    {/* MEETINGS WITH INSTITUTES */}
                    {activityType === "Meetings with Institutes" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Institution Name *</label>
                            <input
                              type="text"
                              value={formData.institutionName || ""}
                              onChange={(e) => handleInputChange("institutionName", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                            <input
                              type="text"
                              value={formData.location || ""}
                              onChange={(e) => handleInputChange("location", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                            <input
                              type="date"
                              value={formData.date || ""}
                              onChange={(e) => handleInputChange("date", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Final Year Students</label>
                            <input
                              type="number"
                              value={formData.finalYearStudents || ""}
                              onChange={(e) => handleInputChange("finalYearStudents", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of Institute</label>
                            <input
                              type="text"
                              value={formData.headOfInstitute || ""}
                              onChange={(e) => handleInputChange("headOfInstitute", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head Contact</label>
                            <input
                              type="tel"
                              value={formData.headContact || ""}
                              onChange={(e) => handleInputChange("headContact", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC from Institute</label>
                            <input
                              type="text"
                              value={formData.spocName || ""}
                              onChange={(e) => handleInputChange("spocName", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC Contact</label>
                            <input
                              type="tel"
                              value={formData.spocContact || ""}
                              onChange={(e) => handleInputChange("spocContact", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC Email</label>
                            <input
                              type="email"
                              value={formData.spocEmail || ""}
                              onChange={(e) => handleInputChange("spocEmail", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* FOLLOW UP WITH INSTITUTES */}
                    {activityType === "Follow up with Institutes" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Institute Profile *</label>
                            <select
                              value={formData.profileId || ""}
                              onChange={(e) => {
                                const profId = e.target.value;
                                const prof = profiles.find(p => p.id === profId);
                                if (prof) {
                                  setFormData(prev => ({
                                    ...prev,
                                    profileId: profId,
                                    profileName: prof.name,
                                    location: prof.location,
                                    ...prof.details
                                  }));
                                } else {
                                  handleInputChange("profileId", "");
                                  handleInputChange("profileName", "");
                                  handleInputChange("location", "");
                                }
                              }}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            >
                              <option value="">-- Select an Institute --</option>
                              {profiles.filter(p => p.type === "Institute").map(p => (
                                <option key={p.id} value={p.id}>{p.name} - {p.location}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                            <input
                              type="text"
                              value={formData.location || ""}
                              onChange={(e) => handleInputChange("location", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                            <input
                              type="date"
                              value={formData.date || ""}
                              onChange={(e) => handleInputChange("date", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mode of Meeting</label>
                            <input
                              type="text"
                              value={formData.modeOfMeeting || ""}
                              placeholder="e.g. In Person, Phone, Email, Video Call"
                              onChange={(e) => handleInputChange("modeOfMeeting", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Feedback from Client *</label>
                            <textarea
                              rows={3}
                              value={formData.clientFeedback || ""}
                              onChange={(e) => handleInputChange("clientFeedback", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white resize-y"
                              required
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* CAMPAIGNS CONDUCTED */}
                    {activityType === "Campaigns Conducted" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Institution Name *</label>
                            <input
                              type="text"
                              value={formData.institutionName || ""}
                              onChange={(e) => handleInputChange("institutionName", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                            <input
                              type="text"
                              value={formData.location || ""}
                              onChange={(e) => handleInputChange("location", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                            <input
                              type="date"
                              value={formData.date || ""}
                              onChange={(e) => handleInputChange("date", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Students Attended</label>
                            <input
                              type="number"
                              value={formData.studentsAttended || ""}
                              onChange={(e) => handleInputChange("studentsAttended", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Students Registered</label>
                            <input
                              type="number"
                              value={formData.studentsRegistered || ""}
                              onChange={(e) => handleInputChange("studentsRegistered", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">List of Students Captured</label>
                            <textarea
                              rows={4}
                              placeholder="Enter captured students details (names, contacts, emails...)"
                              value={formData.studentsCapturedList || ""}
                              onChange={(e) => handleInputChange("studentsCapturedList", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white resize-y"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* PARTICIPATION IN CONFERENCES */}
                    {activityType === "Participation in Conferences" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Conference Name *</label>
                            <input
                              type="text"
                              value={formData.conferenceName || ""}
                              onChange={(e) => handleInputChange("conferenceName", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                            <input
                              type="text"
                              value={formData.location || ""}
                              onChange={(e) => handleInputChange("location", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                            <input
                              type="date"
                              value={formData.date || ""}
                              onChange={(e) => handleInputChange("date", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Target Professionals</label>
                            <input
                              type="text"
                              value={formData.targetProfessionals || ""}
                              placeholder="e.g. Doctors, Nurses, Managers"
                              onChange={(e) => handleInputChange("targetProfessionals", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Participants</label>
                            <input
                              type="number"
                              value={formData.conferenceParticipants || ""}
                              onChange={(e) => handleInputChange("conferenceParticipants", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Footfalls</label>
                            <input
                              type="number"
                              value={formData.footfalls || ""}
                              onChange={(e) => handleInputChange("footfalls", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Registrations</label>
                            <input
                              type="number"
                              value={formData.registrationsCount || ""}
                              onChange={(e) => handleInputChange("registrationsCount", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* MEETINGS WITH HOSPITALS */}
                    {activityType === "Meetings with Hospitals" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hospital Name *</label>
                            <input
                              type="text"
                              value={formData.hospitalName || ""}
                              onChange={(e) => handleInputChange("hospitalName", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                            <input
                              type="text"
                              value={formData.location || ""}
                              onChange={(e) => handleInputChange("location", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                            <input
                              type="date"
                              value={formData.date || ""}
                              onChange={(e) => handleInputChange("date", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Beds</label>
                            <input
                              type="number"
                              value={formData.bedsCount || ""}
                              onChange={(e) => handleInputChange("bedsCount", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Employees</label>
                            <input
                              type="number"
                              value={formData.employeesCount || ""}
                              onChange={(e) => handleInputChange("employeesCount", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of Hospital</label>
                            <input
                              type="text"
                              value={formData.headOfHospital || ""}
                              onChange={(e) => handleInputChange("headOfHospital", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Contact</label>
                            <input
                              type="tel"
                              value={formData.contact || ""}
                              onChange={(e) => handleInputChange("contact", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of HR</label>
                            <input
                              type="text"
                              value={formData.headOfHR || ""}
                              onChange={(e) => handleInputChange("headOfHR", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">HR Contact</label>
                            <input
                              type="tel"
                              value={formData.hrContact || ""}
                              onChange={(e) => handleInputChange("hrContact", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">HR Email</label>
                            <input
                              type="email"
                              value={formData.hrEmail || ""}
                              onChange={(e) => handleInputChange("hrEmail", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* FOLLOW UP WITH HOSPITALS */}
                    {activityType === "Follow up with Hospitals" && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Hospital Profile *</label>
                            <select
                              value={formData.profileId || ""}
                              onChange={(e) => {
                                const profId = e.target.value;
                                const prof = profiles.find(p => p.id === profId);
                                if (prof) {
                                  setFormData(prev => ({
                                    ...prev,
                                    profileId: profId,
                                    profileName: prof.name,
                                    location: prof.location,
                                    ...prof.details
                                  }));
                                } else {
                                  handleInputChange("profileId", "");
                                  handleInputChange("profileName", "");
                                  handleInputChange("location", "");
                                }
                              }}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            >
                              <option value="">-- Select a Hospital --</option>
                              {profiles.filter(p => p.type === "Hospital").map(p => (
                                <option key={p.id} value={p.id}>{p.name} - {p.location}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                            <input
                              type="text"
                              value={formData.location || ""}
                              onChange={(e) => handleInputChange("location", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                            <input
                              type="date"
                              value={formData.date || ""}
                              onChange={(e) => handleInputChange("date", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mode of Meeting</label>
                            <input
                              type="text"
                              value={formData.modeOfMeeting || ""}
                              placeholder="e.g. Email, Call, Onsite"
                              onChange={(e) => handleInputChange("modeOfMeeting", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Feedback from Client *</label>
                            <textarea
                              rows={3}
                              value={formData.clientFeedback || ""}
                              onChange={(e) => handleInputChange("clientFeedback", e.target.value)}
                              className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white resize-y"
                              required
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* SHARED FIELDS FOR ALL ACTIVITIES */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cost of Visit (₹)</label>
                        <input
                          type="number"
                          value={formData.costOfVisit || ""}
                          onChange={(e) => handleInputChange("costOfVisit", e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Marketing Observation</label>
                        <textarea
                          rows={3}
                          value={formData.marketingObservation || ""}
                          onChange={(e) => handleInputChange("marketingObservation", e.target.value)}
                          className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white resize-y"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Activity Details Card (Live Preview) */}
                {selectedActivity && getPrimaryName(formData) !== "N/A" && (
                  <div className="p-4 bg-gray-50 dark:bg-zinc-900/40 rounded-lg border border-gray-150 dark:border-gray-800/60 text-xs space-y-2 animate-none">
                    <p className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[10px]">Activity Preview (Live)</p>
                    <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-gray-150 mt-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {getPrimaryName(selectedActivity)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-gray-500 font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedActivity.location || "N/A"}
                      </span>
                      {selectedActivity.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {selectedActivity.date}
                        </span>
                      )}
                      {selectedActivity.costOfVisit && (
                        <span className="flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" />
                          Cost: ₹{Number(selectedActivity.costOfVisit || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}



                {errorMessage && (
                  <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 text-xs rounded-lg font-semibold leading-relaxed">
                    ⚠️ {errorMessage}
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-zinc-900/10 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !activityType}
                  className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-white dark:text-black px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      {editReportId ? "Update Report" : "Generate & Submit Report"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "Reports" ? (
        <>
      {/* Submitted Reports List (Full Width) */}
      <div>
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-bold tracking-tight">Generated Reports</h2>
                {/* Filter Option */}
                <div className="flex items-center gap-2">
                  <label htmlFor="filterActivity" className="text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    Filter by:
                  </label>
                  <select
                    id="filterActivity"
                    value={filterActivityType}
                    onChange={(e) => setFilterActivityType(e.target.value)}
                    className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white text-xs font-semibold cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="all">All Activity Types</option>
                    {ACTIVITY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {reports.length === 0 ? (
                <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No reports generated yet</h3>
                  <p className="text-gray-500 mt-1">Submit the report form on the left to generate activity summaries.</p>
                </div>
              ) : getFilteredReports().length === 0 ? (
                <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No matching reports</h3>
                  <p className="text-gray-500 mt-1">There are no generated reports with the activity type &quot;{filterActivityType}&quot;.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getFilteredReports().map((report) => (
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
                            : 'bg-gray-100 text-gray-700 dark:bg-zinc-900 dark:text-gray-300 border-gray-200 dark:border-gray-800'
                          }`}>
                          {report.status || 'Draft'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-900">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => triggerPrintModal(report)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Preview
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
        </>
      ) : (
        <>
          {/* ENTITY PROFILES VIEW */}
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <h2 className="text-xl font-bold tracking-tight mb-6">Entity Profiles</h2>
            {profiles.length === 0 ? (
              <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No profiles created yet</h3>
                <p className="text-gray-500 mt-1">Create an Institute or Hospital profile to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.map(p => {
                  const linkedReports = reports.filter(r => r.activityDetails?.profileId === p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedProfileForView(p)}
                      className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-colors bg-white dark:bg-zinc-950 cursor-pointer shadow-sm hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full">{p.type}</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{linkedReports.length} Reports</span>
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{p.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium"><MapPin className="w-3.5 h-3.5" />{p.location}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW PROFILE MODAL */}
      {selectedProfileForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-650 dark:text-gray-400" /> 
                  {selectedProfileForView.name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3"/> {selectedProfileForView.location} • {selectedProfileForView.type} Profile</p>
              </div>
              <div className="flex items-center gap-4">
                {selectedProfileForView.deleteRequested ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-red-500 font-semibold italic bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded border border-red-200/50 dark:border-red-900/30">
                      Delete Requested
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRequestProfileDelete(selectedProfileForView.id, selectedProfileForView.name)}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5 rounded-lg border border-red-100 dark:border-red-900/30"
                  >
                    Request Delete
                  </button>
                )}
                <button type="button" onClick={() => setSelectedProfileForView(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg transition-colors text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Profile Details section */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-100 dark:border-gray-800 pb-2">Profile Information</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Object.entries(selectedProfileForView.details).map(([key, value]) => {
                    if (!value || key === 'institutionName' || key === 'hospitalName' || key === 'location') return null;
                    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return (
                      <div key={key} className="bg-gray-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800/60">
                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">{formattedKey}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{String(value)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Linked Reports section */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-100 dark:border-gray-800 pb-2">Linked Follow-up Reports</h3>
                <div className="space-y-3">
                  {(() => {
                    const linked = reports.filter(r => r.activityDetails?.profileId === selectedProfileForView.id);
                    if (linked.length === 0) return <p className="text-sm text-gray-500 italic">No follow-up reports logged yet.</p>;
                    return linked.map(r => (
                      <div key={r.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer" onClick={() => triggerPrintModal(r)}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{r.activityType}</span>
                          <span className="text-xs text-gray-500">{r.createdAt ? new Date(r.createdAt.toMillis()).toLocaleDateString() : 'Just now'}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2">{r.activityDetails?.modeOfMeeting || "Follow-up Meeting"}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{r.activityDetails?.clientFeedback}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE CREATION MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold flex items-center gap-2"><Building2 className="w-5 h-5 text-gray-650 dark:text-gray-400" /> Create Entity Profile</h2>
              <button type="button" onClick={() => setIsProfileModalOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitProfile} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">Profile Type *</label>
                  <select value={profileType} onChange={(e) => setProfileType(e.target.value as any)} className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-white" required>
                    <option value="">Select Type...</option>
                    <option value="Institute">Institute</option>
                    <option value="Hospital">Hospital</option>
                  </select>
                </div>

                {profileType === "Institute" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-150 dark:border-gray-800/80">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Institution Name *</label>
                      <input type="text" value={profileFormData.institutionName || ""} onChange={(e) => setProfileFormData(p => ({...p, institutionName: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                      <input type="text" value={profileFormData.location || ""} onChange={(e) => setProfileFormData(p => ({...p, location: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Final Year Students</label>
                      <input type="number" value={profileFormData.finalYearStudents || ""} onChange={(e) => setProfileFormData(p => ({...p, finalYearStudents: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of Institute</label>
                      <input type="text" value={profileFormData.headOfInstitute || ""} onChange={(e) => setProfileFormData(p => ({...p, headOfInstitute: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head Contact</label>
                      <input type="tel" value={profileFormData.headContact || ""} onChange={(e) => setProfileFormData(p => ({...p, headContact: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC from Institute</label>
                      <input type="text" value={profileFormData.spocName || ""} onChange={(e) => setProfileFormData(p => ({...p, spocName: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC Contact</label>
                      <input type="tel" value={profileFormData.spocContact || ""} onChange={(e) => setProfileFormData(p => ({...p, spocContact: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC Email</label>
                      <input type="email" value={profileFormData.spocEmail || ""} onChange={(e) => setProfileFormData(p => ({...p, spocEmail: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                  </div>
                )}

                {profileType === "Hospital" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-150 dark:border-gray-800/80">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hospital Name *</label>
                      <input type="text" value={profileFormData.hospitalName || ""} onChange={(e) => setProfileFormData(p => ({...p, hospitalName: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                      <input type="text" value={profileFormData.location || ""} onChange={(e) => setProfileFormData(p => ({...p, location: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Beds</label>
                      <input type="number" value={profileFormData.bedsCount || ""} onChange={(e) => setProfileFormData(p => ({...p, bedsCount: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Employees</label>
                      <input type="number" value={profileFormData.employeesCount || ""} onChange={(e) => setProfileFormData(p => ({...p, employeesCount: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of Hospital</label>
                      <input type="text" value={profileFormData.headOfHospital || ""} onChange={(e) => setProfileFormData(p => ({...p, headOfHospital: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Contact</label>
                      <input type="tel" value={profileFormData.contact || ""} onChange={(e) => setProfileFormData(p => ({...p, contact: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of HR</label>
                      <input type="text" value={profileFormData.headOfHR || ""} onChange={(e) => setProfileFormData(p => ({...p, headOfHR: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">HR Contact</label>
                      <input type="tel" value={profileFormData.hrContact || ""} onChange={(e) => setProfileFormData(p => ({...p, hrContact: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">HR Email</label>
                      <input type="email" value={profileFormData.hrEmail || ""} onChange={(e) => setProfileFormData(p => ({...p, hrEmail: e.target.value}))} className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white" />
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-zinc-900/10 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmittingProfile || !profileType} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-white dark:text-black px-5 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-colors">{isSubmittingProfile ? "Saving..." : "Create Profile"}</button>
              </div>
            </form>
          </div>
        </div>
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
                const details = selectedReportForPrint.activityDetails || selectedActivityForPrint || {};
                return (
                  <div 
                    className="w-full max-w-[760px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] border border-zinc-200 rounded-sm p-12 mx-auto space-y-8 text-left"
                    style={{ backgroundColor: '#ffffff', color: '#18181b', minHeight: '800px' }}
                  >
                    {/* Document Header */}
                    <div className="border-b-2 border-zinc-900 pb-5 flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Activity Performance Report</h2>
                        <p className="text-xs text-zinc-550 mt-1.5 uppercase font-bold tracking-wider">Logged by Marketer: {user?.email || "Unknown Marketer"}</p>
                      </div>
                      <div className="text-right text-xs text-zinc-550 font-bold tracking-tight">
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
                          <div className="font-extrabold text-zinc-900 text-base mt-1">{selectedReportForPrint.activityType}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider">Institution/Hospital Name</div>
                          <div className="font-extrabold text-zinc-900 text-base mt-1">{selectedReportForPrint.activityName}</div>
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
                              {details.hrEmail && <div className="text-xs text-zinc-550 mt-0.5">{details.hrEmail}</div>}
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
                        <div className="text-[10px] text-zinc-550 mt-1.5">{user?.email}</div>
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
    </div>
  );
}
