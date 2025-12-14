export interface IndicatorState {
  mvrv: number;
  ahr999: number;
  maMultiplier: number;
  usdtDom: number;
  funding: number;
  rsi: number;
}

export interface IndicatorDefinition {
  id: keyof IndicatorState;
  name: string;
  weight: number; // percentage 0-100
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
  inverse?: boolean; // If true, lower input = higher score (Wait, logic is specific per metric, so we handle custom logic)
}

export interface CalculationResult {
  totalScore: number;
  breakdown: {
    id: keyof IndicatorState;
    name: string;
    rawScore: number; // 0-100 normalized
    weightedScore: number; // Contribution to total
  }[];
  advice: {
    title: string;
    color: string;
    description: string;
  };
}