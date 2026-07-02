"use client";

import { HealthScore as HealthScoreType } from "@/lib/types";
import { getHealthLabel } from "@/lib/health-score";

interface Props {
  score: HealthScoreType;
  size?: "sm" | "md" | "lg";
}

export default function HealthScore({ score, size = "md" }: Props) {
  const { label, color } = getHealthLabel(score.total);

  const dimensions = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
  };

  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score.total / 100) * circumference;

  let strokeColor = "#ef4444";
  if (score.total >= 80) strokeColor = "#22c55e";
  else if (score.total >= 60) strokeColor = "#3b82f6";
  else if (score.total >= 40) strokeColor = "#eab308";
  else if (score.total >= 20) strokeColor = "#f97316";

  return (
    <div className="flex items-center gap-2">
      <div className={`relative ${dimensions[size]}`}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="none" stroke="#1e293b" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold text-white">{score.total}</span>
        </div>
      </div>
      {size !== "sm" && <span className={`text-sm font-medium ${color}`}>{label}</span>}
    </div>
  );
}
