import React from "react";
import clsx from "clsx";

type Row = {
  label: string;
  value?: string | number | React.ReactNode;
};

type Props = {
  title: string;
  color?: "red" | "green" | "blue" | "gray";
  rows: Row[];
};

export default function CalculatorSection({
  title,
  color = "gray",
  rows,
}: Props) {
  const headerColor = {
    red: "bg-red-200",
    green: "bg-green-200",
    blue: "bg-sky-200",
    gray: "bg-gray-200",
  }[color];

  return (
    <div className="rounded-md overflow-hidden shadow-sm border border-gray-300 bg-gray-100">
      <div className={clsx("px-3 py-2 font-semibold", headerColor)}>
        {title}
      </div>
      <div className="divide-y divide-gray-300">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="grid grid-cols-2 items-center px-3 py-2 bg-white even:bg-gray-50"
          >
            <div className="font-medium">{row.label}</div>
            <div className="text-right">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
