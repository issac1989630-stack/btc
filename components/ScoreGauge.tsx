import React from 'react';

interface ScoreGaugeProps {
  score: number;
  adviceTitle: string;
  adviceColor: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, adviceTitle, adviceColor }) => {
  // Config
  const radius = 120;
  const stroke = 20;
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  
  // Math for SVG Arc
  const circumference = normalizedScore * Math.PI * (radius / 100); 
  // We want a semi-circle. 100 score = 180 degrees.
  // SVG paths for arcs are complex, let's use a simpler rotation transform approach for the "needle" or fill.
  
  // Alternative: Stroke Dasharray approach
  // Full circle length = 2 * PI * R
  // We only show half circle.
  const r = 80;
  const c = Math.PI * r; // Length of the semi-circle arc
  const pct = ((100 - normalizedScore) / 100) * c;

  // Color interpolation
  const getColor = (s: number) => {
    if (s < 20) return '#22c55e'; // Green
    if (s < 40) return '#84cc16'; // Lime
    if (s < 65) return '#eab308'; // Yellow
    if (s < 80) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };
  
  const gaugeColor = getColor(normalizedScore);

  return (
    <div className="flex flex-col items-center justify-center p-6 relative">
      <svg width="240" height="140" viewBox="0 0 200 110" className="overflow-visible">
        {/* Background Track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#334155"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Progress Arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={gaugeColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={pct}
          className="transition-all duration-700 ease-out"
        />
        
        {/* Needle/Text */}
        <text x="100" y="85" textAnchor="middle" fill="white" className="text-4xl font-bold font-mono">
          {score.toFixed(1)}
        </text>
        <text x="100" y="105" textAnchor="middle" fill="#94a3b8" className="text-xs uppercase tracking-widest">
          週期分數
        </text>
      </svg>
      
      <div className={`mt-4 text-center px-4 py-2 rounded-full border ${adviceColor} bg-opacity-10 bg-slate-800`}>
         <h2 className="text-xl font-bold transition-colors duration-300" style={{ color: gaugeColor }}>
            {adviceTitle}
         </h2>
      </div>
    </div>
  );
};