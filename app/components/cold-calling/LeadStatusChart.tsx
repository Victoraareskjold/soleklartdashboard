"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { LeadStatus } from "@/constants/leadStatuses";
import { PieChart as PieChartIcon } from "lucide-react";

interface LeadStatusChartProps {
  summary: { status: number; count: number }[];
}

const LeadStatusChart: React.FC<LeadStatusChartProps> = ({ summary }) => {
  if (!summary || summary.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted">
        <span className="flex size-9 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <PieChartIcon size={16} />
        </span>
        Ingen leads å vise diagram for.
      </div>
    );
  }

  const aggregated = summary.reduce(
    (acc, { status, count }) => {
      if (status > 5 && status !== 22) {
        acc.priceEstimate += count;
      } else {
        acc.byStatus[status] = (acc.byStatus[status] || 0) + count;
      }
      return acc;
    },
    {
      byStatus: {} as Record<number, number>,
      priceEstimate: 0,
    },
  );

  const data = [
    ...Object.entries(aggregated.byStatus).map(([status, count]) => {
      const info = LeadStatus.find((s) => s.value === Number(status));

      return {
        name: info?.label ?? `Ingen status`,
        value: count,
        color: info?.color ?? "#CCCCCC",
      };
    }),
    ...(aggregated.priceEstimate > 0
      ? [
          {
            name: "Vil ha tilbud",
            value: aggregated.priceEstimate,
            color: "#69FF59",
          },
        ]
      : []),
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          labelLine={false}
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={data.length > 1 ? 2 : 0}
          cornerRadius={4}
          stroke="#ffffff"
          strokeWidth={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 10,
            border: "1px solid #e1e6ed",
            boxShadow: "0 12px 32px -8px rgba(11, 27, 51, 0.18)",
            fontSize: 12,
            padding: "6px 10px",
          }}
          itemStyle={{ color: "#0b1b33", fontWeight: 600 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default LeadStatusChart;
