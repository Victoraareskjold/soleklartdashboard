"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { LeadStatus } from "@/constants/leadStatuses";

interface LeadStatusChartProps {
  summary: { status: number; count: number }[];
}

const LeadStatusChart: React.FC<LeadStatusChartProps> = ({ summary }) => {
  if (!summary || summary.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Ingen leads å vise diagram for.
      </div>
    );
  }

  const aggregated = summary.reduce(
    (acc, { status, count }) => {
      if (status > 5) {
        acc.priceEstimate += count;
      } else {
        acc.byStatus[status] = (acc.byStatus[status] || 0) + count;
      }
      return acc;
    },
    {
      byStatus: {} as Record<number, number>,
      priceEstimate: 0,
    }
  );

  const data = [
    ...Object.entries(aggregated.byStatus).map(([status, count]) => {
      const info = LeadStatus.find((s) => s.value === Number(status));

      return {
        name: info?.label ?? `Ingen status`,
        value: count,
        color: info?.color ?? "#333",
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
          outerRadius={80}
          dataKey="value"
          /*  label={({ name, value }) => `${name}: ${value}`} */
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default LeadStatusChart;
