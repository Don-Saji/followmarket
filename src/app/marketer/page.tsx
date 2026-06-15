"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  ClipboardList, 
  Loader2, 
  Calendar, 
  IndianRupee, 
  Building2, 
  Users, 
  Edit, 
  Trash2,
  Search, 
  Filter, 
  Sparkles,
  MapPin,
  Clock
} from "lucide-react";

interface ActivityRecord {
  id: string;
  activityType: string;
  createdAt?: { toMillis: () => number };
  updatedAt?: { toMillis: () => number };
  costOfVisit?: number;
  institutionName?: string;
  hospitalName?: string;
  conferenceName?: string;
  hospitalOrInstitutionName?: string;
  location?: string;
  date?: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const ACTIVITY_TYPES = [
  "Meetings with Institutes",
  "Follow up with Institutes",
  "Campaigns Conducted",
  "Participation in Conferences",
  "Meetings with Hospitals",
  "Follow up with Hospitals"
];

export default function MarketerDashboard() {
  const { user } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);

  // Data State
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [activityType, setActivityType] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Filter and Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");

  // Fetch Activities on Mount
  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchActivities = async () => {
      try {
        const q = query(
          collection(db, "marketer_activities"), 
          where("marketerId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as ActivityRecord));
        
        // Sort descending by createdAt or fallback to local timestamp
        data.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });

        if (active) {
          setActivities(data);
        }
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchActivities();
    return () => {
      active = false;
    };
  }, [user]);

  // Statistics calculation
  const stats = {
    total: activities.length,
    totalCost: activities.reduce((sum, item) => sum + (Number(item.costOfVisit) || 0), 0),
    meetings: activities.filter(a => a.activityType.startsWith("Meetings")).length,
    followups: activities.filter(a => a.activityType.startsWith("Follow up")).length,
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
    if (!editId) {
      setFormData({}); // Clear form data in creation mode
    }
  };

  const handleReset = () => {
    setActivityType("");
    setFormData({});
    setEditId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activityType) return;

    setIsSubmitting(true);
    try {
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

      if (editId) {
        // Edit Mode: Update Firestore doc
        const docRef = doc(db, "marketer_activities", editId);
        await updateDoc(docRef, {
          ...formattedData,
          activityType,
          updatedAt: serverTimestamp()
        });

        // Update local state
        setActivities(prev => prev.map(item => 
          item.id === editId 
            ? { 
                ...item, 
                ...formattedData, 
                activityType,
                updatedAt: { toMillis: () => Date.now() } 
              } 
            : item
        ));
      } else {
        // Create Mode: Add Firestore doc
        const docRef = await addDoc(collection(db, "marketer_activities"), {
          marketerId: user.uid,
          marketerEmail: user.email,
          activityType,
          ...formattedData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const newRecord: ActivityRecord = {
          id: docRef.id,
          marketerId: user.uid,
          activityType,
          ...formattedData,
          createdAt: { toMillis: () => Date.now() },
          updatedAt: { toMillis: () => Date.now() }
        };

        setActivities(prev => [newRecord, ...prev]);
      }

      handleReset();
    } catch (error) {
      console.error("Error saving activity:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (record: ActivityRecord) => {
    setEditId(record.id);
    setActivityType(record.activityType);
    
    // Copy fields and remove metadata keys to load into formData
    const formFields = { ...record } as Record<string, unknown>;
    delete formFields.id;
    delete formFields.marketerId;
    delete formFields.marketerEmail;
    delete formFields.activityType;
    delete formFields.createdAt;
    delete formFields.updatedAt;
    setFormData(formFields);
    
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this activity log? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "marketer_activities", id));
      setActivities(prev => prev.filter(item => item.id !== id));
      if (editId === id) {
        handleReset();
      }
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  };

  // Helper to extract the primary name of the event/place
  const getPrimaryName = (record: ActivityRecord) => {
    return (
      record.institutionName ||
      record.hospitalName ||
      record.conferenceName ||
      record.hospitalOrInstitutionName ||
      "N/A"
    );
  };

  // Filter and Search logic
  const filteredActivities = activities.filter(act => {
    const nameMatch = getPrimaryName(act).toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (act.location || "").toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = filterType === "All" || act.activityType === filterType;
    return nameMatch && typeMatch;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketer Activity Dashboard</h1>
          <p className="text-gray-500 mt-1">Log visits, follow-ups, and campaigns dynamically and track historical logs.</p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Logs</p>
            <h3 className="text-2xl font-bold tracking-tight mt-0.5">{stats.total}</h3>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-lg">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Cost</p>
            <h3 className="text-2xl font-bold tracking-tight mt-0.5">₹{stats.totalCost.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-lg">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Meetings</p>
            <h3 className="text-2xl font-bold tracking-tight mt-0.5">{stats.meetings}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Follow-ups</p>
            <h3 className="text-2xl font-bold tracking-tight mt-0.5">{stats.followups}</h3>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Container and History List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Column */}
        <div ref={formRef} className="lg:col-span-5 h-fit">
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm sticky top-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                {editId ? "Edit Activity Log" : "Log Activity"}
              </h2>
              {editId && (
                <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full font-semibold">
                  Editing mode
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Activity Type Dropdown */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                  Activity Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={activityType}
                  onChange={handleActivityTypeChange}
                  disabled={!!editId} // Prevent change of type during edit for schema stability
                  className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm disabled:opacity-60"
                  required
                >
                  <option value="">Select Activity Type...</option>
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {editId && (
                  <p className="text-xs text-gray-400 mt-1">Activity type cannot be modified for a saved log.</p>
                )}
              </div>

              {/* Dynamic Fields Section */}
              {activityType ? (
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800 transition-all duration-300">
                  
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
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                          <input
                            type="text"
                            value={formData.location || ""}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Final Year Students</label>
                          <input
                            type="number"
                            value={formData.finalYearStudents || ""}
                            onChange={(e) => handleInputChange("finalYearStudents", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of Institute</label>
                          <input
                            type="text"
                            value={formData.headOfInstitute || ""}
                            onChange={(e) => handleInputChange("headOfInstitute", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head Contact</label>
                          <input
                            type="tel"
                            value={formData.headContact || ""}
                            onChange={(e) => handleInputChange("headContact", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC from Institute</label>
                          <input
                            type="text"
                            value={formData.spocName || ""}
                            onChange={(e) => handleInputChange("spocName", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC Contact</label>
                          <input
                            type="tel"
                            value={formData.spocContact || ""}
                            onChange={(e) => handleInputChange("spocContact", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SPOC Email</label>
                          <input
                            type="email"
                            value={formData.spocEmail || ""}
                            onChange={(e) => handleInputChange("spocEmail", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Institution Name *</label>
                          <input
                            type="text"
                            value={formData.institutionName || ""}
                            onChange={(e) => handleInputChange("institutionName", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                          <input
                            type="text"
                            value={formData.location || ""}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                          <input
                            type="date"
                            value={formData.date || ""}
                            onChange={(e) => handleInputChange("date", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Feedback from Client *</label>
                          <textarea
                            rows={3}
                            value={formData.clientFeedback || ""}
                            onChange={(e) => handleInputChange("clientFeedback", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-y"
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
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                          <input
                            type="text"
                            value={formData.location || ""}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Students Attended</label>
                          <input
                            type="number"
                            value={formData.studentsAttended || ""}
                            onChange={(e) => handleInputChange("studentsAttended", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Students Registered</label>
                          <input
                            type="number"
                            value={formData.studentsRegistered || ""}
                            onChange={(e) => handleInputChange("studentsRegistered", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">List of Students Captured</label>
                          <textarea
                            rows={4}
                            placeholder="Enter captured students details (names, contacts, emails...)"
                            value={formData.studentsCapturedList || ""}
                            onChange={(e) => handleInputChange("studentsCapturedList", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-y"
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
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                          <input
                            type="text"
                            value={formData.location || ""}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Participants</label>
                          <input
                            type="number"
                            value={formData.conferenceParticipants || ""}
                            onChange={(e) => handleInputChange("conferenceParticipants", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Footfalls</label>
                          <input
                            type="number"
                            value={formData.footfalls || ""}
                            onChange={(e) => handleInputChange("footfalls", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Registrations</label>
                          <input
                            type="number"
                            value={formData.registrationsCount || ""}
                            onChange={(e) => handleInputChange("registrationsCount", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                          <input
                            type="text"
                            value={formData.location || ""}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Beds</label>
                          <input
                            type="number"
                            value={formData.bedsCount || ""}
                            onChange={(e) => handleInputChange("bedsCount", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Employees</label>
                          <input
                            type="number"
                            value={formData.employeesCount || ""}
                            onChange={(e) => handleInputChange("employeesCount", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of Hospital</label>
                          <input
                            type="text"
                            value={formData.headOfHospital || ""}
                            onChange={(e) => handleInputChange("headOfHospital", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Contact</label>
                          <input
                            type="tel"
                            value={formData.contact || ""}
                            onChange={(e) => handleInputChange("contact", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Head of HR</label>
                          <input
                            type="text"
                            value={formData.headOfHR || ""}
                            onChange={(e) => handleInputChange("headOfHR", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">HR Contact</label>
                          <input
                            type="tel"
                            value={formData.hrContact || ""}
                            onChange={(e) => handleInputChange("hrContact", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">HR Email</label>
                          <input
                            type="email"
                            value={formData.hrEmail || ""}
                            onChange={(e) => handleInputChange("hrEmail", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Institution/Hospital Name *</label>
                          <input
                            type="text"
                            value={formData.hospitalOrInstitutionName || ""}
                            onChange={(e) => handleInputChange("hospitalOrInstitutionName", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location *</label>
                          <input
                            type="text"
                            value={formData.location || ""}
                            onChange={(e) => handleInputChange("location", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date *</label>
                          <input
                            type="date"
                            value={formData.date || ""}
                            onChange={(e) => handleInputChange("date", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
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
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Feedback from Client *</label>
                          <textarea
                            rows={3}
                            value={formData.clientFeedback || ""}
                            onChange={(e) => handleInputChange("clientFeedback", e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-y"
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
                        className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Marketing Observation</label>
                      <textarea
                        rows={3}
                        value={formData.marketingObservation || ""}
                        onChange={(e) => handleInputChange("marketingObservation", e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white resize-y"
                      />
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 bg-black text-white dark:bg-white dark:text-black py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {editId ? "Update Activity" : "Submit Activity"}
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-4 py-2.5 border border-gray-200 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                </div>
              ) : (
                /* Empty state when no activity is selected */
                <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-zinc-900/10 mt-4">
                  <ClipboardList className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-300">Form is hidden</h4>
                  <p className="text-xs text-gray-500 max-w-[200px] mx-auto mt-1">Select an Activity Type from the dropdown to start logging details.</p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* History List Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight mb-6">Activity Logs</h2>
            
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full border border-gray-200 dark:border-gray-800 bg-transparent rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
              </div>
              <div className="relative sm:w-48">
                <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                >
                  <option value="All">All Types</option>
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logs List */}
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-450" />
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-zinc-900/10">
                <ClipboardList className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-300">No logs found</h4>
                <p className="text-xs text-gray-500 max-w-[280px] mx-auto mt-1">There are no logs matching your criteria. Try adjusting your search filters or start logging new activities.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredActivities.map((act) => (
                  <div key={act.id} className="p-5 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-gray-300 dark:hover:border-zinc-700 transition-colors bg-gray-50/30 dark:bg-zinc-900/10 flex flex-col justify-between">
                    <div>
                      {/* Badge and Actions */}
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${
                          act.activityType.includes("Institutes") 
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30" 
                            : act.activityType.includes("Hospitals")
                            ? "bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border-sky-200/50 dark:border-sky-900/30"
                            : "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-900/30"
                        }`}>
                          {act.activityType}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(act)}
                            disabled={editId === act.id}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black dark:hover:text-white transition-colors border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1 disabled:opacity-50"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          
                          <button
                            onClick={() => handleDelete(act.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-750 transition-colors border border-red-200/50 dark:border-red-900/30 rounded-lg px-2.5 py-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Primary Info */}
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mt-1">
                        {getPrimaryName(act)}
                      </h3>

                      {/* Details row */}
                      <div className="flex flex-wrap gap-y-2 gap-x-4 mt-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                        {act.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {act.location}
                          </span>
                        )}
                        {act.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Date: {act.date}
                          </span>
                        )}
                        {act.costOfVisit !== undefined && (
                          <span className="flex items-center gap-1">
                            <IndianRupee className="w-3.5 h-3.5" />
                            Cost: ₹{Number(act.costOfVisit).toLocaleString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Logged: {act.createdAt ? new Date(act.createdAt.toMillis()).toLocaleDateString() : "Just now"}
                        </span>
                      </div>

                      {/* Observation Details */}
                      {(act.marketingObservation || act.clientFeedback || act.studentsCapturedList) && (
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2">
                          {act.clientFeedback && (
                            <div className="text-xs">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Feedback:</span>{" "}
                              <p className="text-gray-650 dark:text-gray-400 mt-0.5 inline-block w-full whitespace-pre-wrap">{act.clientFeedback}</p>
                            </div>
                          )}
                          {act.marketingObservation && (
                            <div className="text-xs">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Observations:</span>{" "}
                              <p className="text-gray-650 dark:text-gray-400 mt-0.5 inline-block w-full whitespace-pre-wrap">{act.marketingObservation}</p>
                            </div>
                          )}
                          {act.studentsCapturedList && (
                            <div className="text-xs">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">Students Captured:</span>{" "}
                              <p className="text-gray-650 dark:text-gray-400 mt-0.5 inline-block w-full whitespace-pre-wrap">{act.studentsCapturedList}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
