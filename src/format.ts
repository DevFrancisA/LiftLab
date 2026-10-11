const MINUS = '−';

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtNum(x: number, d = 1): string {
  const s = Math.abs(x).toFixed(d);
  return x < 0 && Number(s) !== 0 ? MINUS + s : s;
}

export function fmtSigned(x: number, d = 1): string {
  const s = Math.abs(x).toFixed(d);
  if (Number(s) === 0) return s;
  return (x > 0 ? '+' : MINUS) + s;
}

/** Probability as a percentage, e.g. 0.0412 → "4.1%". */
export function fmtPct(p: number, d = 1): string {
  return `${fmtNum(p * 100, d)}%`;
}

/** Difference of probabilities in percentage points, e.g. 0.036 → "+3.6 pp". */
export function fmtPP(x: number, d = 1): string {
  return `${fmtSigned(x * 100, d)} pp`;
}

export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `${fmtNum(n / 1000, n % 1000 === 0 ? 0 : 1)}k`;
  return fmtInt(n);
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}
