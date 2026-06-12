"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

export default function MarketerDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your marketing campaigns and performance.</p>
        </div>
        <Link 
          href="/marketer/campaigns/new"
          className="flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          <PlusCircle className="w-4 h-4" />
          New Campaign
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: "Active Campaigns", value: "3" },
          { label: "Pending Approvals", value: "1" },
          { label: "Remaining Budget", value: "$12,400" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-black p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            <div className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold tracking-tight">Recent Campaigns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 font-medium">Campaign Name</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Budget</th>
                <th className="px-6 py-3 font-medium">Audience</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Summer Launch", status: "Active", budget: "$4,000", audience: "Gen Z" },
                { name: "Q3 Retargeting", status: "Pending", budget: "$2,500", audience: "Cart Abandoners" },
                { name: "Brand Awareness", status: "Active", budget: "$1,200", audience: "Millennials" },
              ].map((campaign, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{campaign.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      campaign.status === 'Active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{campaign.budget}</td>
                  <td className="px-6 py-4 text-gray-500">{campaign.audience}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
