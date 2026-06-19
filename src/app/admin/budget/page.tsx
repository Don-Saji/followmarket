"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { IndianRupee, Loader2, Download, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface Marketer {
  id: string;
  name?: string;
  email?: string;
  budgetUsed?: number;
  activityCount?: number;
}

export default function AdminBudgetPage() {
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting and Filtering States
  const [sortField, setSortField] = useState<"name" | "activities" | "budget">("name");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        // 1. Fetch marketers list
        const q = query(collection(db, "users"), where("role", "==", "marketer"));
        const querySnapshot = await getDocs(q);
        const marketersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Marketer));

        // 2. Fetch all reports to aggregate marketer spending
        const reportsSnap = await getDocs(collection(db, "reports"));
        const fetchedReports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        if (active) {
          setMarketers(marketersData);
          setReports(fetchedReports);
        }
      } catch (error) {
        console.error("Error fetching admin budget page data:", error);
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

  const toggleSort = (field: "name" | "activities" | "budget") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filter reports based on selected date range (Start Date and End Date)
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const reportDate = r.activityDetails?.date 
        ? new Date(r.activityDetails.date) 
        : (r.createdAt ? new Date(r.createdAt.toMillis()) : null);

      if (!reportDate) return true;

      // Normalize reportDate to midnight for date-only comparison
      const reportTime = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate()).getTime();

      if (startDate) {
        const start = new Date(startDate);
        const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        if (reportTime < startTime) return false;
      }

      if (endDate) {
        const end = new Date(endDate);
        const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
        if (reportTime > endTime) return false;
      }

      return true;
    });
  }, [reports, startDate, endDate]);

  // Dynamically calculate and process marketer stats and apply search filter
  const processedUsers = useMemo(() => {
    const usedMap: { [key: string]: number } = {};
    const countMap: { [key: string]: number } = {};
    
    filteredReports.forEach(r => {
      const mId = r.marketerId;
      const cost = Number(r.activityDetails?.costOfVisit) || 0;
      if (mId) {
        usedMap[mId] = (usedMap[mId] || 0) + cost;
        countMap[mId] = (countMap[mId] || 0) + 1;
      }
    });

    let list = marketers.map(m => ({
      ...m,
      budgetUsed: usedMap[m.id] || 0,
      activityCount: countMap[m.id] || 0
    }));

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m => 
        (m.name || "").toLowerCase().includes(q) || 
        (m.email || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [marketers, filteredReports, searchQuery]);

  const sortedUsers = useMemo(() => {
    const list = [...processedUsers];
    list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortField === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      } else if (sortField === "activities") {
        valA = a.activityCount || 0;
        valB = b.activityCount || 0;
      } else if (sortField === "budget") {
        valA = a.budgetUsed || 0;
        valB = b.budgetUsed || 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [processedUsers, sortField, sortAsc]);

  const downloadBudgetExcel = () => {
    const headers = [
      "Log Date",
      "Marketer Name",
      "Marketer Email",
      "Activity Type",
      "Activity Name",
      "Activity Date",
      "Location",
      "Cost of Visit (INR)",
      "Meeting Mode",
      "Head (Institute/Hospital/HR)",
      "Head Contact",
      "SPOC Name",
      "SPOC Contact",
      "SPOC Email",
      "Final Year Students",
      "Students Attended",
      "Students Registered",
      "Beds Count",
      "Employees Count",
      "Target Professionals",
      "Conference Participants",
      "Footfalls",
      "Registrations Count"
    ];

    // Filter reports based on active month and matching marketers in filtered processedUsers
    const matchingUserIds = new Set(processedUsers.map(u => u.id));
    const exportReports = filteredReports.filter(r => matchingUserIds.has(r.marketerId));

    const rows = exportReports.map(r => {
      const details = r.activityDetails || {};
      const marketer = marketers.find(u => u.id === r.marketerId);
      const marketerName = marketer?.name || "Unknown";
      
      const headName = details.headOfInstitute || details.headOfHospital || details.headOfHR || "N/A";
      const headContact = details.headContact || details.contact || details.hrContact || "N/A";
      const logDate = r.createdAt ? new Date(r.createdAt.toMillis()).toLocaleDateString() : "N/A";

      return [
        logDate,
        marketerName,
        r.marketerEmail || marketer?.email || "N/A",
        r.activityType || "N/A",
        r.activityName || "N/A",
        details.date || "N/A",
        details.location || "N/A",
        details.costOfVisit !== undefined ? details.costOfVisit : 0,
        details.modeOfMeeting || "N/A",
        headName,
        headContact,
        details.spocName || "N/A",
        details.spocContact || "N/A",
        details.spocEmail || "N/A",
        details.finalYearStudents !== undefined ? details.finalYearStudents : "N/A",
        details.studentsAttended !== undefined ? details.studentsAttended : "N/A",
        details.studentsRegistered !== undefined ? details.studentsRegistered : "N/A",
        details.bedsCount !== undefined ? details.bedsCount : "N/A",
        details.employeesCount !== undefined ? details.employeesCount : "N/A",
        details.targetProfessionals || "N/A",
        details.conferenceParticipants !== undefined ? details.conferenceParticipants : "N/A",
        details.footfalls !== undefined ? details.footfalls : "N/A",
        details.registrationsCount !== undefined ? details.registrationsCount : "N/A"
      ];
    });

    const csvContent = [
      headers,
      ...rows
    ]
      .map(row => row.map(val => {
        const strVal = String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      }).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const startStr = startDate ? `_from_${startDate}` : "";
    const endStr = endDate ? `_to_${endDate}` : "";
    const searchStr = searchQuery.trim() ? `_filtered` : "";
    link.setAttribute("download", `detailed_budget_report${startStr}${endStr}${searchStr}_${new Date().toISOString().split("T")[0]}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalUsed = useMemo(() => {
    return processedUsers.reduce((sum, u) => sum + (u.budgetUsed || 0), 0);
  }, [processedUsers]);

  const chartData = useMemo(() => {
    return processedUsers.map(u => ({
      name: u.name || "Unknown",
      "Used Budget": u.budgetUsed || 0,
    }));
  }, [processedUsers]);

  return (
    <div>
      <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget Management</h1>
          <p className="text-gray-555 mt-1">Track and manage budgets for your marketers.</p>
        </div>
        {!loading && reports.length > 0 && (
          <button
            onClick={downloadBudgetExcel}
            className="inline-flex items-center gap-2 bg-blue-600 text-white dark:bg-white dark:text-black px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 dark:hover:opacity-90 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : marketers.length === 0 ? (
        <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <IndianRupee className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No marketers found</h3>
          <p className="text-gray-555 mt-1 font-medium">Marketers budget usage will appear once accounts are created.</p>
        </div>
      ) : (
        <>
          {/* Filtering Block */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-gray-50 dark:bg-zinc-900/30 p-4 rounded-xl border border-gray-200 dark:border-gray-800 mb-6 shadow-xs animate-fade-in">
            {/* Search Input */}
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search marketer by name or email..."
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

            {/* Date Range Selectors and Reset Button */}
            <div className="flex flex-wrap items-center gap-3">
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

              {(searchQuery || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Summary Stats Card (Full Width) */}
          <div className="mb-8 animate-fade-in">
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-gray-555 font-semibold uppercase tracking-wider">Total Budget Used Across Platform</p>
                  <h3 className="text-3xl font-bold tracking-tight mt-1">₹{totalUsed.toLocaleString()}</h3>
                </div>
              </div>
              <div className="hidden md:block text-right">
                <p className="text-xs text-gray-555 font-medium">Tracking active marketer expenditures</p>
                <p className="text-xs text-gray-440 mt-1">Based on logged visits and activities</p>
              </div>
            </div>
          </div>

          {processedUsers.length === 0 ? (
            <div className="bg-white dark:bg-black p-12 rounded-lg border border-gray-200 dark:border-gray-800 text-center animate-fade-in">
              <IndianRupee className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No matching marketers found</h3>
              <p className="text-gray-555 mt-1 font-medium">Try adjusting your month or marketer search filters.</p>
            </div>
          ) : (
            <>
              {/* Marketers Budget Details Table */}
              <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs animate-fade-in">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-550 uppercase bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800 select-none">
                    <tr>
                      <th 
                        onClick={() => toggleSort("name")}
                        className="px-6 py-3 font-semibold cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          Marketer
                          {sortField === "name" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 font-semibold">Email</th>
                      <th 
                        onClick={() => toggleSort("activities")}
                        className="px-6 py-3 font-semibold text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          Activities
                          {sortField === "activities" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => toggleSort("budget")}
                        className="px-6 py-3 font-semibold text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          Used Budget
                          {sortField === "budget" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((user) => {
                      return (
                        <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                          <td className="px-6 py-4 font-medium">{user.name || "N/A"}</td>
                          <td className="px-6 py-4 text-gray-550">{user.email}</td>
                          <td className="px-6 py-4 text-center font-medium text-gray-700 dark:text-gray-300">
                            {user.activityCount || 0}
                          </td>
                          <td className="px-6 py-4 font-semibold text-amber-600 dark:text-amber-400 text-right">
                            ₹{(user.budgetUsed || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Line Graph Comparison Chart Section */}
              <div className="mt-8 bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
                <h2 className="text-lg font-bold tracking-tight mb-4">Marketer Budget Spend Trend</h2>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="opacity-20" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `₹${value.toLocaleString()}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "rgba(0, 0, 0, 0.85)", 
                          border: "none", 
                          borderRadius: "8px",
                          color: "#fff",
                          fontSize: "12px"
                        }} 
                        formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                      <Line 
                        type="monotone" 
                        dataKey="Used Budget" 
                        stroke="#f59e0b" 
                        strokeWidth={2.5}
                        activeDot={{ r: 8 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
