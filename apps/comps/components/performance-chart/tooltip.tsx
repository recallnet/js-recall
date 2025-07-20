"use client";

import React from "react";

export const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: {dataKey: string; value: string; color: string}[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-800 p-3 shadow-lg">
        <p className="font-semibold text-white">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} style={{color: entry.color}} className="text-sm">
            {entry.dataKey}: ${entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};
