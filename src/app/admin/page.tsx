"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, where, DocumentData, setDoc, doc } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, Info, Pencil, Check } from "lucide-react";

const COLORS = ["#6366f1", "#a855f7", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"];

// Custom Tooltip for PieChart - shown on hover
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-3 rounded-lg shadow-lg text-xs min-w-[180px]">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-1.5 mb-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: payload[0].color }} />
          <p className="font-bold text-gray-900 dark:text-gray-100">{data.fullName}</p>
        </div>
        <div className="space-y-1 text-gray-600 dark:text-gray-300">
          <div className="flex justify-between gap-6">
            <span className="font-medium">Budget Used:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">₹{data.cost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="font-medium">Activities:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{data.count}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<DocumentData[]>([]);
  const [activeMarketersCount, setActiveMarketersCount] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<"cost" | "count">("cost");

  const [targetTab, setTargetTab] = useState<"Institution" | "Hospital">("Institution");
  const [targets, setTargets] = useState<{ [key: string]: number }>({});
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        // 1. Fetch reports to map them as activities for the stats dashboard
        const rSnap = await getDocs(collection(db, "reports"));
        const fetchedActivities = rSnap.docs.map(doc => {
          const data = doc.data();
          return {
            activityType: data.activityType || "",
            activityName: data.activityName || "",
            costOfVisit: data.activityDetails?.costOfVisit !== undefined ? Number(data.activityDetails.costOfVisit) : 0,
            createdAt: data.createdAt || null,
            date: data.activityDetails?.date || null
          };
        });

        // 2. Get active marketers data
        const marketersQ = query(collection(db, "users"), where("role", "==", "marketer"));
        const marketersSnap = await getDocs(marketersQ);

        if (active) {
          setActivities(fetchedActivities);
          setActiveMarketersCount(marketersSnap.size);
        }

        // Fetch targets
        const targetsSnap = await getDocs(collection(db, "targets"));
        const fetchedTargets: { [key: string]: number } = {};
        targetsSnap.docs.forEach(doc => {
          fetchedTargets[doc.id] = doc.data().target || 0;
        });

        if (active) {
          setTargets(fetchedTargets);
        }
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      active = false;
    };
  }, []);

  // Compute overall totals
  const stats = useMemo(() => {
    let totalCost = 0;
    activities.forEach((data) => {
      totalCost += Number(data.costOfVisit) || 0;
    });
    return {
      totalActivities: activities.length,
      activeMarketers: activeMarketersCount,
      totalCost: totalCost,
    };
  }, [activities, activeMarketersCount]);

  // Generate array of months from when marketing started up to now
  const targetMonths = useMemo(() => {
    const now = new Date();
    
    // Find the earliest date among all activities
    let earliestDate = now;
    activities.forEach(act => {
      const actDate = act.date 
        ? new Date(act.date) 
        : (act.createdAt 
            ? (typeof act.createdAt.toMillis === 'function' 
                ? new Date(act.createdAt.toMillis()) 
                : new Date(act.createdAt)) 
            : null);
      if (actDate && actDate < earliestDate) {
        earliestDate = actDate;
      }
    });

    const months = [];
    const startYear = earliestDate.getFullYear();
    const startMonth = earliestDate.getMonth();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const totalMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth) + 1;
    // Cap to a reasonable limit just in case (e.g. 60 months = 5 years) to prevent infinite UI loops
    const safeTotalMonths = Math.min(Math.max(totalMonths, 1), 60);

    for (let i = 0; i < safeTotalMonths; i++) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        monthName: d.toLocaleString('default', { month: 'long' }),
      });
    }
    return months.reverse(); // Chronological order: Oldest to Newest
  }, [activities]);

  // Pre-calculate target activity counts by month to optimize rendering
  const aggregatedCounts = useMemo(() => {
    const counts: Record<string, { Institution: number, Hospital: number }> = {};
    
    activities.forEach(act => {
      if (act.activityType === "Follow up with Institutes" || act.activityType === "Follow up with Hospitals") {
        const actDate = act.date 
          ? new Date(act.date) 
          : (act.createdAt 
              ? (typeof act.createdAt.toMillis === 'function' 
                  ? new Date(act.createdAt.toMillis()) 
                  : new Date(act.createdAt)) 
              : null);
              
        if (actDate) {
          const year = actDate.getFullYear();
          const monthIndex = actDate.getMonth();
          const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          
          if (!counts[monthKey]) {
            counts[monthKey] = { Institution: 0, Hospital: 0 };
          }
          
          if (act.activityType === "Follow up with Institutes") {
            counts[monthKey].Institution += 1;
          } else {
            counts[monthKey].Hospital += 1;
          }
        }
      }
    });
    
    return counts;
  }, [activities]);

  // Compute breakdown for PieChart
  const pieChartData = useMemo(() => {
    const typeMap: Record<string, { cost: number; count: number }> = {};
    const ACTIVITY_TYPES = [
      "Follow up with Institutes",
      "Campaigns Conducted",
      "Participation in Conferences",
      "Follow up with Hospitals"
    ];

    ACTIVITY_TYPES.forEach(t => {
      typeMap[t] = { cost: 0, count: 0 };
    });

    activities.forEach(act => {
      const type = act.activityType || "Other";
      if (!typeMap[type]) {
        typeMap[type] = { cost: 0, count: 0 };
      }
      typeMap[type].cost += Number(act.costOfVisit) || 0;
      typeMap[type].count += 1;
    });

    return Object.entries(typeMap)
      .map(([name, val]) => ({
        name: name
          .replace("Meetings with ", "")
          .replace("Follow up with ", "")
          .replace("Participation in ", "")
          .replace("Conducted", ""),
        fullName: name,
        cost: val.cost,
        count: val.count,
        value: selectedMetric === "cost" ? val.cost : val.count
      }))
      .filter(item => item.cost > 0 || item.count > 0);
  }, [activities, selectedMetric]);

  const totalValue = useMemo(() => {
    return pieChartData.reduce((sum, item) => sum + item.value, 0);
  }, [pieChartData]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {user?.displayName || "Admin"}!</h1>
        <p className="text-gray-500 mt-1">Admin Dashboard</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: "Total Activities Logged", value: stats.totalActivities.toString() },
              { label: "Active Marketers", value: stats.activeMarketers.toString() },
              { label: "Total Cost of Visits", value: `₹${stats.totalCost.toLocaleString()}` },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Activity Breakdown</h2>
                <p className="text-xs text-gray-500 mt-0.5">Distribution of platform activities and marketing costs.</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="metric-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Show Distribution:
                </label>
                <select
                  id="metric-select"
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as "cost" | "count")}
                  className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white cursor-pointer"
                >
                  <option value="cost">By Budget Spent (₹)</option>
                  <option value="count">By Activity Volume</option>
                </select>
              </div>
            </div>

            {pieChartData.length === 0 ? (
              <div className="h-80 flex flex-col justify-center items-center text-center">
                <p className="text-gray-500 text-sm">No activity data logged to display.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mt-6">
                {/* Pie Chart */}
                <div className="md:col-span-7 h-72 flex justify-center items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom High-Fidelity Legend */}
                <div className="md:col-span-5 space-y-3.5 max-h-[300px] overflow-y-auto pr-2">
                  {pieChartData.map((entry, index) => {
                    const pct = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={entry.fullName} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900/55 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <div className="truncate">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-250 truncate">{entry.name}</p>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase">{entry.count} {entry.count === 1 ? 'Activity' : 'Activities'}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-black text-gray-900 dark:text-gray-100">
                            {selectedMetric === "cost" ? `₹${entry.cost.toLocaleString()}` : entry.count}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-bold">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Monthly Targets Section */}
          <div className="mt-8 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm animate-fade-in">
            {/* Header and Toggle */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight">
                    {targetTab === "Institution" ? "Institution Follow-up Targets" : "Hospital Follow-up Targets"}
                  </h2>
                  <div className="group relative flex items-center justify-center text-gray-400 hover:text-gray-500 cursor-help">
                    <Info className="w-4 h-4" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 text-center">
                      Set monthly target goals. Green rows indicate the target has been met.
                    </div>
                  </div>
                </div>

                <div className="flex p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg shrink-0">
                  <button
                    onClick={() => setTargetTab("Institution")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      targetTab === "Institution" 
                        ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                    }`}
                  >
                    Institution
                  </button>
                  <button
                    onClick={() => setTargetTab("Hospital")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      targetTab === "Hospital" 
                        ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm" 
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                    }`}
                  >
                    Hospital
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">All months since marketing started • Click target value to edit</p>
            </div>

            {/* Targets Table */}
            <div className="overflow-x-auto">
              {mounted ? (
                <table className="w-full text-sm text-center">
                  <thead className="text-xs text-white uppercase bg-blue-600 dark:bg-blue-600">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold text-left">Month</th>
                      <th className="px-6 py-3.5 font-semibold">Monthly Target</th>
                      <th className="px-6 py-3.5 font-semibold">Reports Submitted</th>
                      <th className="px-6 py-3.5 font-semibold">Achieved Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {targetMonths.map(({ year, monthIndex, monthName }) => {
                      const displayMonth = `${monthName} ${year}`;
                      
                      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
                      const targetId = `${monthKey}_${targetTab}`;
                      const currentTarget = targets[targetId] || 0;

                      // Aggregate reports for this month
                      const submittedReports = aggregatedCounts[monthKey]?.[targetTab] || 0;

                      const isTargetMet = currentTarget > 0 && submittedReports >= currentTarget;
                      const isEditing = editingTargetId === targetId;

                      return (
                        <tr 
                          key={targetId} 
                          className={`transition-colors ${
                            isTargetMet 
                              ? "bg-green-100/60 dark:bg-green-900/20" 
                              : "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20"
                          }`}
                        >
                          <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-left">
                            {displayMonth}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={editingTargetValue}
                                  onChange={(e) => setEditingTargetValue(e.target.value)}
                                  className="w-20 px-2 py-1 text-center text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white dark:bg-black text-black dark:text-white"
                                  autoFocus
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      const val = parseInt(editingTargetValue) || 0;
                                      try {
                                        await setDoc(doc(db, "targets", targetId), { target: val }, { merge: true });
                                        setTargets(prev => ({ ...prev, [targetId]: val }));
                                      } catch (err) {
                                        console.error("Error updating target", err);
                                      }
                                      setEditingTargetId(null);
                                    }
                                    if (e.key === 'Escape') {
                                      setEditingTargetId(null);
                                    }
                                  }}
                                />
                                <button 
                                  onClick={async () => {
                                    const val = parseInt(editingTargetValue) || 0;
                                    try {
                                      await setDoc(doc(db, "targets", targetId), { target: val }, { merge: true });
                                      setTargets(prev => ({ ...prev, [targetId]: val }));
                                    } catch (err) {
                                      console.error("Error updating target", err);
                                    }
                                    setEditingTargetId(null);
                                  }}
                                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div 
                                className="group flex items-center justify-center gap-1.5 cursor-pointer"
                                onClick={() => {
                                  setEditingTargetId(targetId);
                                  setEditingTargetValue(String(currentTarget));
                                }}
                                title="Click to edit"
                              >
                                <span className="text-base">{currentTarget}</span>
                                <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-300">
                            {submittedReports}
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                            {submittedReports} / {currentTarget}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>



        </>
      )}
    </div>
  );
}
