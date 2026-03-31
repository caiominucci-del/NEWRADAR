"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/types";

function formatLabel(date: string) {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  const [y, m, d] = parts;
  return `${d}/${m}`;
}

export default function TrendChart({
  points,
  height = 260,
}: {
  points: TrendPoint[];
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <XAxis
            dataKey="date"
            tickFormatter={formatLabel}
            stroke="rgba(255,255,255,0.65)"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="rgba(255,255,255,0.65)"
            tick={{ fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.25)",
              borderRadius: 12,
            }}
            formatter={(value: any, name: any) => [value, "Valor"]}
            labelFormatter={(label: any) => String(label)}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgba(99,102,241,0.95)"
            strokeWidth={3}
            dot={{ r: 3, fill: "rgba(99,102,241,0.95)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

