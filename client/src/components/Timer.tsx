import React from 'react';

interface TimerProps {
  remaining: number;
  total?: number;
}

export default function Timer({ remaining, total = 90 }: TimerProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, remaining / total);
  const dashOffset = circumference * (1 - progress);

  const color =
    remaining > 30 ? '#22c55e' : remaining > 10 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        {/* background track */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth="6"
        />
        {/* progress arc */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s' }}
        />
        <text
          x="44"
          y="44"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="20"
          fontWeight="bold"
          fill={color}
        >
          {remaining}
        </text>
      </svg>
    </div>
  );
}
