import React from 'react';

interface InputSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  weight: number;
  description: string;
  detailedInfo?: string;
  inverse?: boolean; // New prop: if true, min is Sell and max is Buy
}

export const InputSlider: React.FC<InputSliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  weight,
  description,
  detailedInfo,
  inverse = false
}) => {
  return (
    <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex justify-between items-center mb-2">
        <div>
            <h3 className="text-sm font-semibold text-slate-200">{label}</h3>
            <p className="text-xs text-slate-400">{description}</p>
        </div>
        <div className="text-right">
            <span className="block text-lg font-bold text-orange-400 font-mono">
            {value}{unit}
            </span>
            <span className="text-xs text-slate-500 font-mono">權重: {weight}%</span>
        </div>
      </div>
      
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer mb-2"
        style={{
           // Optional: reverse the gradient visual if supported, or keep standard UI
        }}
      />
      
      <div className="flex justify-between text-xs text-slate-500 mb-3">
        {inverse ? (
            <>
                <span className="text-red-400">{min}{unit} (賣出/貪婪)</span>
                <span className="text-green-400">{max}{unit} (買入/恐懼)</span>
            </>
        ) : (
            <>
                <span className="text-green-400">{min}{unit} (買入)</span>
                <span className="text-red-400">{max}{unit} (賣出)</span>
            </>
        )}
      </div>

      {detailedInfo && (
        <div className="mt-2 pt-3 border-t border-slate-700/50">
          <div className="bg-slate-900/60 rounded p-3 text-xs leading-relaxed text-slate-400 border-l-2 border-slate-600">
            <span className="font-bold text-orange-500/80 mr-1">指標解讀:</span>
            {detailedInfo}
          </div>
        </div>
      )}
    </div>
  );
};