import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface BreakdownChartProps {
  data: {
    name: string;
    weightedScore: number;
    rawScore: number;
  }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl">
        <p className="font-bold text-slate-200">{label}</p>
        <p className="text-sm text-slate-400">
          原始指標分數: <span className="text-white font-mono">{data.rawScore.toFixed(0)}/100</span>
        </p>
        <p className="text-sm text-orange-400">
          對總分的影響: <span className="font-bold font-mono">+{data.weightedScore.toFixed(1)}</span> 分
        </p>
      </div>
    );
  }
  return null;
};

export const BreakdownChart: React.FC<BreakdownChartProps> = ({ data }) => {
  return (
    <div className="h-64 w-full mt-4">
      <h3 className="text-slate-400 text-sm font-semibold mb-4 uppercase tracking-wider">分數貢獻細項</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 40,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" domain={[0, 30]} hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={80} 
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{fill: '#334155', opacity: 0.2}} />
          <Bar dataKey="weightedScore" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.rawScore > 80 ? '#ef4444' : entry.rawScore < 20 ? '#22c55e' : '#f59e0b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};