"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Bucket = { date: string; total: number; critical: number; resolved: number };

export function IssuesChart() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  useEffect(() => {
    fetch("/api/issues/stats?period=30d")
      .then((r) => r.json())
      .then((data) => setBuckets(data.buckets ?? []))
      .catch(() => setBuckets([]));
  }, []);

  if (buckets.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">Issues over time</h2>
        <p className="text-sm text-gray-400">No data yet</p>
      </div>
    );
  }

  const data = buckets.map((b) => ({
    ...b,
    dateShort: b.date.slice(5),
  }));

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-sm font-medium text-gray-500 mb-4">Issues over time (last 30 days)</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateShort" tick={{ fontSize: 11 }} stroke="#6b7280" />
            <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
            <Tooltip
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}
              labelStyle={{ color: "#374151" }}
              labelFormatter={(label) => "Date: " + label}
            />
            <Legend />
            <Line type="monotone" dataKey="total" name="Total" stroke="#2d2d2d" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="critical" name="Critical" stroke="#dc2626" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
