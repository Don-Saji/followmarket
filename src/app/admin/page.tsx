"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, where, DocumentData } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2 } from "lucide-react";

interface ChartDataItem {
  name: string;
  activities: number;
  cost: number;
}

export default function AdminDashboard() {
  useAuth();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<DocumentData[]>([]);
  const [activeMarketersCount, setActiveMarketersCount] = useState(0);
  const [selectedActivityType, setSelectedActivityType] = useState<string>("All");

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        // 1. Get total activities and sum of costs
        const actSnap = await getDocs(collection(db, "marketer_activities"));
        const fetchedActivities = actSnap.docs.map(doc => doc.data());

        // 2. Get active marketers count
        const marketersQ = query(collection(db, "users"), where("role", "==", "marketer"));
        const marketersSnap = await getDocs(marketersQ);

        if (active) {
          setActivities(fetchedActivities);
          setActiveMarketersCount(marketersSnap.size);
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

  const { stats, chartData } = useMemo(() => {
    const filtered = selectedActivityType === "All"
      ? activities
      : activities.filter(act => act.activityType === selectedActivityType);

    let totalCost = 0;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyDataMap: Record<string, { activities: number; cost: number }> = {};
    const tempChartData: ChartDataItem[] = [];
    const now = new Date();

    // Initialize the last 6 months in order
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = months[d.getMonth()];
      monthlyDataMap[monthName] = { activities: 0, cost: 0 };
      tempChartData.push({ name: monthName, activities: 0, cost: 0 });
    }

    filtered.forEach((data) => {
      if (data.costOfVisit !== undefined) {
        totalCost += Number(data.costOfVisit) || 0;
      }

      let dateObj: Date | null = null;
      if (data.createdAt) {
        dateObj = typeof data.createdAt.toMillis === "function"
          ? new Date(data.createdAt.toMillis())
          : new Date(data.createdAt);
      } else if (data.date) {
        dateObj = new Date(data.date);
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        const mName = months[dateObj.getMonth()];
        if (monthlyDataMap[mName]) {
          monthlyDataMap[mName].activities += 1;
          monthlyDataMap[mName].cost += Number(data.costOfVisit) || 0;
        }
      }
    });

    // Update chart data array
    tempChartData.forEach((item) => {
      item.activities = monthlyDataMap[item.name].activities;
      item.cost = monthlyDataMap[item.name].cost;
    });

    return {
      stats: {
        totalActivities: filtered.length,
        activeMarketers: activeMarketersCount,
        totalCost: totalCost,
      },
      chartData: tempChartData,
    };
  }, [activities, selectedActivityType, activeMarketersCount]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back. Here&apos;s an overview of the platform.</p>
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
              <h2 className="text-lg font-bold tracking-tight">Activity Volume & Costs</h2>
              <div className="flex items-center gap-2">
                <label htmlFor="activity-type-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Activity Type:
                </label>
                <select
                  id="activity-type-filter"
                  value={selectedActivityType}
                  onChange={(e) => setSelectedActivityType(e.target.value)}
                  className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                >
                  <option value="All">All Activities</option>
                  <option value="Meetings with Institutes">Meetings with Institutes</option>
                  <option value="Follow up with Institutes">Follow up with Institutes</option>
                  <option value="Campaigns Conducted">Campaigns Conducted</option>
                  <option value="Participation in Conferences">Participation in Conferences</option>
                  <option value="Meetings with Hospitals">Meetings with Hospitals</option>
                  <option value="Follow up with Hospitals">Follow up with Hospitals</option>
                </select>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Bar yAxisId="left" name="Cost (₹)" dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" name="Activities" dataKey="activities" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
