"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "Jan", campaigns: 4, budget: 2400 },
  { name: "Feb", campaigns: 3, budget: 1398 },
  { name: "Mar", campaigns: 6, budget: 9800 },
  { name: "Apr", campaigns: 8, budget: 3908 },
  { name: "May", campaigns: 5, budget: 4800 },
  { name: "Jun", campaigns: 9, budget: 3800 },
];

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back. Here's an overview of the platform.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: "Total Campaigns", value: "35", change: "+12%" },
          { label: "Active Marketers", value: "12", change: "+2" },
          { label: "Total Budget Spent", value: "$42,500", change: "+5.4%" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
              <span className="text-sm font-medium text-green-500">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold mb-6 tracking-tight">Campaign Performance & Budget</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
              <YAxis yAxisId="right" orientation="right" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', borderColor: '#333', color: '#fff', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line yAxisId="left" type="monotone" dataKey="budget" stroke="#000" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} className="dark:stroke-white" />
              <Line yAxisId="right" type="monotone" dataKey="campaigns" stroke="#888" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
