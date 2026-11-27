export interface NumberStats {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
}

export function getNumberStats(values: number[]): NumberStats {
  const count = values.length;
  return {
    count,
    average: count ? Number((values.reduce((sum, value) => sum + value, 0) / count).toFixed(2)) : null,
    min: count ? values.reduce((minimum, value) => Math.min(minimum, value), values[0]) : null,
    max: count ? values.reduce((maximum, value) => Math.max(maximum, value), values[0]) : null,
  };
}
