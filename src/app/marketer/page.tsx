"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import {
  ClipboardList,
  Loader2,
  IndianRupee,
  CheckCircle2,
  TrendingUp,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface Report {
  id: string;
  status?: string;
  createdAt?: { toMillis: () => number };
  activityType: string;
  activityName: string;
  activityDetails?: {
    costOfVisit?: number;
    [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}

const ACTIVITY_TYPES = [
  "Follow up with Institutes",
  "Campaigns Conducted",
  "Participation in Conferences",
  "Follow up with Hospitals"
];

// Custom Tooltip for Timeline Area Chart
const TimelineTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 p-3 rounded-lg shadow-lg text-xs min-w-[140px]">
        <p className="font-bold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800 pb-1 mb-1">{label}</p>
        {payload.map((pld: any) => (
          <div key={pld.name} className="flex justify-between gap-4 items-center">
            <span className="text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pld.stroke || pld.color || pld.fill }} />
              {pld.name}:
            </span>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {pld.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Label for Marketer Pie Chart - percentage centered on each slice
const renderMarketerPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (!percent || percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  // Position label at the midpoint of the slice arc
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="700"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Custom Tooltip for Budget Pie Chart
const BudgetTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-250 dark:border-gray-800 p-3 rounded-lg shadow-lg text-xs min-w-[150px]">
        <p className="font-bold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800 pb-1 mb-1">{data.category}</p>
        <div className="flex justify-between gap-4 items-center">
          <span className="text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            Spent:
          </span>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            ₹{Number(payload[0].value || 0).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function MarketerDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [marketerName, setMarketerName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchReports = async () => {
      try {
        // Fetch marketer profile details from users collection
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && active) {
          setMarketerName(userDoc.data().name || "");
        }

        const q = query(
          collection(db, "reports"),
          where("marketerId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Report));

        if (active) {
          setReports(data);
        }
      } catch (error) {
        console.error("Error fetching reports for dashboard:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchReports();
    return () => {
      active = false;
    };
  }, [user]);

  // Derived Stats
  const totalReports = reports.length;
  const totalBudget = reports.reduce((sum, item) => sum + (Number(item.activityDetails?.costOfVisit) || 0), 0);
  const reviewedCount = reports.filter(r => r.status === "Reviewed").length;
  const pendingCount = reports.filter(r => r.status === "Submitted" || r.status === "Draft" || !r.status).length;

  // Chart 1 Data: Timeline of Reports logged by Date
  const getTimelineData = () => {
    const dateMap = new Map<string, { count: number; budget: number; timestamp: number }>();

    reports.forEach(r => {
      if (r.createdAt) {
        const ms = r.createdAt.toMillis();
        const d = new Date(ms);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        const existing = dateMap.get(dateStr) || { count: 0, budget: 0, timestamp: ms };
        existing.count += 1;
        existing.budget += Number(r.activityDetails?.costOfVisit) || 0;
        existing.timestamp = Math.min(existing.timestamp, ms);
        dateMap.set(dateStr, existing);
      }
    });

    return Array.from(dateMap.entries())
      .map(([date, val]) => ({
        date,
        "Reports Logged": val.count,
        "Budget (₹)": val.budget,
        timestamp: val.timestamp
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-10); // Show last 10 active days
  };

  // Chart 2 Data: Budget spent per activity classification / category
  const getBudgetData = () => {
    if (selectedCategoryFilter === "all") {
      // Group by activity type/category
      const typeMap: { [key: string]: number } = {};
      reports.forEach(r => {
        const type = r.activityType || "Other";
        typeMap[type] = (typeMap[type] || 0) + (Number(r.activityDetails?.costOfVisit) || 0);
      });

      const data = Object.keys(typeMap).map(type => {
        const cleanLabel = type
          .replace("Meetings with ", "")
          .replace("Follow up with ", "")
          .replace("Participation in ", "")
          .replace("Conducted", "");

        return {
          category: cleanLabel,
          "Budget Spent (₹)": typeMap[type]
        };
      });

      // Sort alphabetically by default
      data.sort((a, b) => a.category.localeCompare(b.category));
      return data;
    } else {
      // Group by individual activity names within the selected category filter
      const filteredReports = reports.filter(r => r.activityType === selectedCategoryFilter);

      const nameMap: { [key: string]: number } = {};
      filteredReports.forEach(r => {
        const name = r.activityName || "Unknown";
        nameMap[name] = (nameMap[name] || 0) + (Number(r.activityDetails?.costOfVisit) || 0);
      });

      const data = Object.keys(nameMap).map(name => ({
        category: name,
        "Budget Spent (₹)": nameMap[name]
      }));

      // Sort alphabetically by default
      data.sort((a, b) => a.category.localeCompare(b.category));
      return data;
    }
  };

  const timelineData = getTimelineData();
  const budgetData = getBudgetData();

  const COLORS = ["#6366f1", "#a855f7", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome Back, {marketerName || "Marketer"}!
          </h1>
          <p className="text-gray-500 mt-1">Real-time charts and summaries of your logged activities and expenditures.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
        </div>
      ) : totalReports === 0 ? (
        <div className="bg-white dark:bg-zinc-950 p-16 rounded-2xl border border-gray-200 dark:border-gray-800 text-center max-w-2xl mx-auto shadow-xs">
          <ClipboardList className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-700 mb-6" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">No activity data logged yet</h3>
          <p className="text-gray-500 mt-2 mb-8 max-w-md mx-auto">
            Dynamic analytics, budget expenditure graphs, and reporting lists will display here once you log your first activity.
          </p>
          <Link
            href="/marketer/reports"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-white dark:text-black px-6 py-3 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Log Activity & Create Report
          </Link>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Reports</p>
                <h3 className="text-2xl font-bold tracking-tight mt-0.5">{totalReports}</h3>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-gray-100 dark:bg-zinc-900 text-black dark:text-white rounded-lg">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Budget Logged</p>
                <h3 className="text-2xl font-bold tracking-tight mt-0.5">₹{totalBudget.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Reviewed Logs</p>
                <h3 className="text-2xl font-bold tracking-tight mt-0.5">{reviewedCount}</h3>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Pending Logs</p>
                <h3 className="text-2xl font-bold tracking-tight mt-0.5">{pendingCount}</h3>
              </div>
            </div>
          </div>

          {/* Sliding Graph Cards Container */}
          <div className="relative w-full overflow-hidden">
            {/* Slide Navigation Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveSlide(0)}
                  className={`px-4.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeSlide === 0 ? 'bg-blue-600 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-gray-100 hover:bg-gray-180 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-gray-650 dark:text-gray-350'}`}
                >
                  Work Activity Timeline
                </button>
                <button
                  onClick={() => setActiveSlide(1)}
                  className={`px-4.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeSlide === 1 ? 'bg-blue-600 text-white dark:bg-white dark:text-black shadow-sm' : 'bg-gray-100 hover:bg-gray-180 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-gray-650 dark:text-gray-350'}`}
                >
                  Budget Expenditure
                </button>
              </div>

              {/* Prev / Next Arrows */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSlide(prev => (prev === 0 ? 1 : 0))}
                  className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-lg text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  aria-label="Previous Slide"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActiveSlide(prev => (prev === 1 ? 0 : 1))}
                  className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-lg text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  aria-label="Next Slide"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Slider Window */}
            <div className="w-full overflow-hidden rounded-2xl border border-gray-205 dark:border-gray-800 bg-white dark:bg-zinc-950 shadow-xs">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {/* Slide 1 - Timeline Area Chart */}
                <div className="w-full flex-shrink-0 p-6 sm:p-8">
                  <div className="mb-4">
                    <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">Work Activity Timeline</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Frequency of activities logged across the last active days.</p>
                  </div>
                  <div className="h-72 w-full mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.15)" />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        />
                        <Tooltip content={<TimelineTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="Reports Logged"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorReports)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Slide 2 - Budget Bar Chart */}
                <div className="w-full flex-shrink-0 p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">Budget Expenditure</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Marketing funds spent per activity category.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-950 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-white cursor-pointer"
                      >
                        <option value="all">All Categories</option>
                        {ACTIVITY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="h-72 w-full mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={budgetData}
                          dataKey="Budget Spent (₹)"
                          nameKey="category"
                          cx="50%"
                          cy="48%"
                          innerRadius={65}
                          outerRadius={105}
                          paddingAngle={4}
                          label={renderMarketerPieLabel}
                          labelLine={false}
                        >
                          {budgetData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<BudgetTooltip />} />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
