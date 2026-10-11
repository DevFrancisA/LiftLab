import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { estimatedCurve, type Dataset, type Selection } from '../data/model';
import { fmtInt, fmtNum, niceTicks } from '../format';

// ───────────────────────────── helpers ─────────────────────────────

export function useWidth<T extends HTMLElement>(fallback = 640): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}

const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

function pathFrom(xs: number[], ys: number[], sx: (v: number) => number, sy: (v: number) => number): string {
  return xs.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join('');
}

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

export function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div className="tooltip" style={{ left: tip.x, top: tip.y }} role="status" aria-live="polite">
      {tip.content}
    </div>
  );
}

export const SERIES = {
  uplift: 'var(--teal-series)',
  twoModel: 'var(--indigo)',
  random: 'var(--gray-series)',
};

// ───────────────────────────── overview: estimated uplift curve with cutoff ─────────────────────────────

export function UpliftCurveChart({ ds, selection, budget, onBudget }: { ds: Dataset; selection: Selection; budget: number; onBudget: (v: number) => void }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(720);
  const height = width < 520 ? 260 : 320;
  const m = { top: 28, right: width < 520 ? 14 : 112, bottom: 40, left: 52 };
  const iw = Math.max(80, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const curve = useMemo(() => {
    const est = estimatedCurve(ds, ds.primary, 200);
    const seeds = ds.runs.map((r) => estimatedCurve(ds, r, 200).y);
    const lo = est.x.map((_, i) => Math.min(...seeds.map((s) => s[i])));
    const hi = est.x.map((_, i) => Math.max(...seeds.map((s) => s[i])));
    return { ...est, lo, hi };
  }, [ds]);

  const total = ds.totalEstimated;
  const n = ds.pop.n;
  const yMax = niceTicks(0, Math.max(...curve.hi) * 1.06, 5);
  const top = yMax[yMax.length - 1];
  const sx = linear(0, 1, 0, iw);
  const sy = linear(0, top, ih, 0);
  const b = budget / 100;
  const peak = selection.peakBudget;
  const peakIdx = Math.round(peak * 200);

  const valueAt = (frac: number) => ds.primary.cumTau[Math.max(0, Math.min(n, Math.round(frac * n)))];

  const estPathPre = pathFrom(curve.x.slice(0, peakIdx + 1), curve.y.slice(0, peakIdx + 1), sx, sy);
  const estPathPost = pathFrom(curve.x.slice(peakIdx), curve.y.slice(peakIdx), sx, sy);
  const bandPath = `${pathFrom(curve.x, curve.hi, sx, sy)}L${curve.x
    .slice()
    .reverse()
    .map((x, i) => `${sx(x).toFixed(1)},${sy(curve.lo[curve.lo.length - 1 - i]).toFixed(1)}`)
    .join('L')}Z`;
  const cutIdx = Math.round(b * 200);
  const areaXs = [...curve.x.slice(0, cutIdx + 1), b];
  const areaYs = [...curve.y.slice(0, cutIdx + 1), valueAt(b)];
  const areaPath = `${pathFrom(areaXs, areaYs, sx, sy)}L${sx(b)},${sy(0)}L${sx(0)},${sy(0)}Z`;

  const fracFromEvent = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return b;
    return Math.max(0.01, Math.min(1, (clientX - rect.left - m.left) / iw));
  };

  const onDown = (e: RPointerEvent<SVGElement>) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    onBudget(Math.round(fracFromEvent(e.clientX) * 100));
  };
  const onMove = (e: RPointerEvent<SVGElement>) => {
    const f = fracFromEvent(e.clientX);
    if (dragging) onBudget(Math.round(f * 100));
    else setHover(f);
  };
  const onUp = (e: RPointerEvent<SVGElement>) => {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    let v = budget;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= step;
    else if (e.key === 'PageUp') v += 10;
    else if (e.key === 'PageDown') v -= 10;
    else if (e.key === 'Home') v = 1;
    else if (e.key === 'End') v = 100;
    else return;
    e.preventDefault();
    onBudget(Math.max(1, Math.min(100, v)));
  };

  const xTicks = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const cutX = sx(b);
  const cutY = sy(valueAt(b));
  const randY = sy(b * total);
  const hoverF = hover !== null && !dragging ? Math.round(hover * 100) / 100 : null;
  const hoverK = hoverF !== null ? Math.max(1, Math.round(hoverF * n)) : 0;
  const hoverSeeds = hoverF !== null ? ds.runs.map((r) => r.cumTau[hoverK]) : [];

  return (
    <div className="chart" ref={wrapRef}>
      <ul className="chart-legend" aria-hidden="true">
        <li>
          <span className="swatch-line" style={{ borderColor: SERIES.uplift }} />
          Uplift-ranked targeting (model estimate)
        </li>
        <li>
          <span className="swatch-band" />
          Range across 5 seeds
        </li>
        <li>
          <span className="swatch-line is-dashed" style={{ borderColor: SERIES.random }} />
          Random targeting
        </li>
        <li>
          <span className="swatch-line" style={{ borderColor: 'var(--coral)' }} />
          Past the peak (ads lower conversion)
        </li>
      </ul>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={`Estimated incremental conversions by share of audience targeted. At ${budget}%, the model estimates ${fmtInt(selection.estIncremental)} incremental conversions versus ${fmtInt(selection.randomIncremental)} for random targeting. The curve peaks at ${Math.round(peak * 100)}% of the audience.`}
      >
        <g transform={`translate(${m.left},${m.top})`}>
          {yMax.map((t) => (
            <g key={t}>
              <line className="gridline" x1={0} x2={iw} y1={sy(t)} y2={sy(t)} />
              <text x={-10} y={sy(t)} dy="0.32em" textAnchor="end">
                {fmtInt(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={ih + 18} textAnchor="middle">
              {Math.round(t * 100)}%
            </text>
          ))}
          <text className="axis-title" x={iw / 2} y={ih + 36} textAnchor="middle">
            Share of audience targeted, ranked by predicted uplift
          </text>
          <text className="axis-title" x={-m.left + 2} y={-14}>
            Incremental conversions (test split)
          </text>
          <line className="baseline" x1={0} x2={iw} y1={ih} y2={ih} />

          <path d={areaPath} fill="var(--teal-wash)" />
          <path d={bandPath} fill="var(--amber-wash)" stroke="var(--amber)" strokeWidth={0.75} strokeOpacity={0.6} opacity={0.85} />
          <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(total)} stroke={SERIES.random} strokeWidth={2} strokeDasharray="5 4" />
          <path d={estPathPost} fill="none" stroke="var(--coral)" strokeWidth={2} />
          <path d={estPathPre} fill="none" stroke={SERIES.uplift} strokeWidth={2.5} />

          {/* peak marker */}
          <g transform={`translate(${sx(peak)},${sy(valueAt(peak))})`}>
            <line y1={-6} y2={-18} stroke="var(--ink-3)" />
            <circle r={3.5} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
            <text y={-22} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>
              peak {Math.round(peak * 100)}%
            </text>
          </g>

          {/* direct labels at right edge */}
          {width >= 520 ? (
            <>
              <text className="direct-label" x={iw + 8} y={sy(curve.y[curve.y.length - 1]) - 8}>
                Uplift model
              </text>
              <text className="direct-label" x={iw + 8} y={sy(total) + 14} style={{ fontWeight: 500, fill: 'var(--ink-3)' }}>
                Random
              </text>
            </>
          ) : null}

          {/* hover crosshair */}
          {hoverF !== null ? <line x1={sx(hoverF)} x2={sx(hoverF)} y1={0} y2={ih} stroke="var(--ink-3)" strokeDasharray="2 3" /> : null}

          <rect
            className="plot-hit"
            x={0}
            y={0}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
          />

          {/* cutoff */}
          <g
            className={`cutoff-handle${dragging ? ' is-dragging' : ''}`}
            tabIndex={0}
            role="slider"
            aria-label="Targeting cutoff"
            aria-valuemin={1}
            aria-valuemax={100}
            aria-valuenow={budget}
            aria-valuetext={`Top ${budget}% of audience, ${fmtInt(selection.k)} users`}
            onKeyDown={onKey}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <rect x={cutX - 10} y={-10} width={20} height={ih + 10} fill="transparent" />
            <line x1={cutX} x2={cutX} y1={-6} y2={ih} stroke="var(--ink)" strokeWidth={1.5} />
            <circle className="knob-ring" cx={cutX} cy={-6} r={11} fill="none" />
            <circle className="knob" cx={cutX} cy={-6} r={7} />
            <path d={`M${cutX - 2.5},-8.5v5M${cutX + 2.5},-8.5v5`} stroke="var(--teal)" strokeWidth={1.2} />
          </g>
          <circle cx={cutX} cy={randY} r={4} fill="var(--surface)" stroke={SERIES.random} strokeWidth={2} pointerEvents="none" />
          <circle cx={cutX} cy={cutY} r={5} fill={b > peak ? 'var(--coral)' : SERIES.uplift} stroke="var(--surface)" strokeWidth={2} pointerEvents="none" />
          <text className="direct-label" x={cutX + (b > 0.7 ? -10 : 10)} y={cutY - 10} textAnchor={b > 0.7 ? 'end' : 'start'} pointerEvents="none">
            {fmtInt(selection.estIncremental)} est.
          </text>
          <text x={cutX + (b > 0.7 ? -10 : 10)} y={randY + 16} textAnchor={b > 0.7 ? 'end' : 'start'} pointerEvents="none" style={{ fill: 'var(--ink-2)' }}>
            {fmtInt(selection.randomIncremental)} random
          </text>
        </g>
      </svg>
      <Tooltip
        tip={
          hoverF !== null
            ? {
                x: Math.min(width - 90, Math.max(90, m.left + sx(hoverF))),
                y: m.top + sy(valueAt(hoverF)) + 28,
                content: (
                  <>
                    <div className="tooltip-title">
                      Top {Math.round(hoverF * 100)}% · {fmtInt(hoverK)} users
                    </div>
                    <div className="tooltip-row">
                      <span>
                        <i className="tooltip-key" style={{ background: SERIES.uplift }} />
                        Uplift model
                      </span>
                      <b>{fmtInt(valueAt(hoverF))}</b>
                    </div>
                    <div className="tooltip-row">
                      <span>
                        <i className="tooltip-key" style={{ background: 'var(--amber)' }} />
                        Seed range
                      </span>
                      <b>
                        {fmtInt(Math.min(...hoverSeeds))}–{fmtInt(Math.max(...hoverSeeds))}
                      </b>
                    </div>
                    <div className="tooltip-row">
                      <span>
                        <i className="tooltip-key" style={{ background: SERIES.random }} />
                        Random
                      </span>
                      <b>{fmtInt(hoverF * total)}</b>
                    </div>
                    <div className="tooltip-title" style={{ marginTop: 6, marginBottom: 0 }}>
                      click to set budget
                    </div>
                  </>
                ),
              }
            : null
        }
      />
    </div>
  );
}

// ───────────────────────────── evaluation: measured uplift curves ─────────────────────────────

export interface LineSeries {
  key: string;
  label: string;
  short?: string;
  color: string;
  dashed?: boolean;
  faint?: boolean;
  x: number[];
  y: number[];
}

export function MeasuredCurvesChart({ series, n, highlightBudget }: { series: LineSeries[]; n: number; highlightBudget?: number }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(720);
  const height = width < 520 ? 260 : 300;
  const m = { top: 24, right: width < 520 ? 14 : 100, bottom: 40, left: 52 };
  const iw = Math.max(80, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const all = series.flatMap((s) => s.y.map((v) => v * n));
  const yt = niceTicks(Math.min(0, ...all), Math.max(...all) * 1.05, 5);
  const sx = linear(0, 1, 0, iw);
  const sy = linear(yt[0], yt[yt.length - 1], ih, 0);
  const main = series.filter((s) => !s.faint);
  const xs = series[0]?.x ?? [];

  const onMove = (e: RPointerEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const f = (e.clientX - rect.left - m.left) / iw;
    let best = 0;
    xs.forEach((x, i) => {
      if (Math.abs(x - f) < Math.abs(xs[best] - f)) best = i;
    });
    setHoverIdx(best);
  };

  const labelYs = main.map((s) => sy(s.y[s.y.length - 1] * n));
  // nudge end labels apart
  const order = labelYs.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const placed: number[] = new Array(main.length);
  let last = -Infinity;
  order.forEach(([y, i]) => {
    const yy = Math.max(y, last + 16);
    placed[i] = yy;
    last = yy;
  });

  return (
    <div className="chart" ref={wrapRef}>
      <ul className="chart-legend">
        {main.map((s) => (
          <li key={s.key}>
            <span className={`swatch-line${s.dashed ? ' is-dashed' : ''}`} style={{ borderColor: s.color }} />
            {s.label}
          </li>
        ))}
        {series.some((s) => s.faint) ? (
          <li>
            <span className="swatch-line" style={{ borderColor: 'var(--line-strong)', borderTopWidth: 1.5 }} />
            Other seeds
          </li>
        ) : null}
      </ul>
      <svg ref={svgRef} width={width} height={height} role="img" aria-label={`Measured uplift curves on the held-out test split for ${main.map((s) => s.label).join(', ')}.`}>
        <g transform={`translate(${m.left},${m.top})`}>
          {yt.map((t) => (
            <g key={t}>
              <line className="gridline" x1={0} x2={iw} y1={sy(t)} y2={sy(t)} />
              <text x={-10} y={sy(t)} dy="0.32em" textAnchor="end">
                {fmtInt(t)}
              </text>
            </g>
          ))}
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
            <text key={t} x={sx(t)} y={ih + 18} textAnchor="middle">
              {Math.round(t * 100)}%
            </text>
          ))}
          <text className="axis-title" x={iw / 2} y={ih + 36} textAnchor="middle">
            Share of test split targeted
          </text>
          <text className="axis-title" x={-m.left + 2} y={-10}>
            Measured incremental conversions
          </text>
          <line className="baseline" x1={0} x2={iw} y1={sy(0)} y2={sy(0)} />
          {highlightBudget !== undefined ? (
            <g>
              <line x1={sx(highlightBudget)} x2={sx(highlightBudget)} y1={0} y2={ih} stroke="var(--ink-3)" strokeDasharray="1 3" />
              <text x={sx(highlightBudget) + 5} y={10} style={{ fill: 'var(--ink-2)' }}>
                {Math.round(highlightBudget * 100)}% budget
              </text>
            </g>
          ) : null}
          {series
            .filter((s) => s.faint)
            .map((s) => (
              <path key={s.key} d={pathFrom(s.x, s.y.map((v) => v * n), sx, sy)} fill="none" stroke={s.color} strokeOpacity={0.35} strokeWidth={1.25} />
            ))}
          {main.map((s) => (
            <path key={s.key} d={pathFrom(s.x, s.y.map((v) => v * n), sx, sy)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.25} strokeDasharray={s.dashed ? '5 4' : undefined} />
          ))}
          {width >= 520
            ? main.map((s, i) => (
                <text key={s.key} className="direct-label" x={iw + 8} y={placed[i]} dy="0.32em" style={{ fontWeight: s.dashed ? 500 : 600 }}>
                  {s.short ?? s.label}
                </text>
              ))
            : null}
          {hoverIdx !== null ? (
            <g pointerEvents="none">
              <line x1={sx(xs[hoverIdx])} x2={sx(xs[hoverIdx])} y1={0} y2={ih} stroke="var(--ink-3)" strokeDasharray="2 3" />
              {main.map((s) => (
                <circle key={s.key} cx={sx(s.x[hoverIdx])} cy={sy(s.y[hoverIdx] * n)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          ) : null}
          <rect className="plot-hit" x={0} y={0} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHoverIdx(null)} />
        </g>
      </svg>
      <Tooltip
        tip={
          hoverIdx !== null
            ? {
                x: Math.min(width - 90, Math.max(90, m.left + sx(xs[hoverIdx]))),
                y: m.top + Math.min(...main.map((s) => sy(s.y[hoverIdx] * n))),
                content: (
                  <>
                    <div className="tooltip-title">Top {Math.round(xs[hoverIdx] * 100)}% targeted</div>
                    {main.map((s) => (
                      <div className="tooltip-row" key={s.key}>
                        <span>
                          <i className="tooltip-key" style={{ background: s.color }} />
                          {s.short ?? s.label}
                        </span>
                        <b>{fmtInt(s.y[hoverIdx] * n)}</b>
                      </div>
                    ))}
                  </>
                ),
              }
            : null
        }
      />
    </div>
  );
}

// ───────────────────────────── evaluation: AUUC by model with seed dots ─────────────────────────────

export interface AuucRow {
  key: string;
  label: string;
  color: string;
  mean: number;
  sd: number;
  values: { seed: number; v: number }[];
  note?: string;
}

export function AuucChart({ rows, scale = 1000 }: { rows: AuucRow[]; scale?: number }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(560);
  const labelW = width < 480 ? 92 : 150;
  const rowH = 54;
  const m = { top: 8, right: 64, bottom: 30, left: labelW };
  const iw = Math.max(60, width - m.left - m.right);
  const height = m.top + rows.length * rowH + m.bottom;
  const maxV = Math.max(...rows.flatMap((r) => r.values.map((v) => v.v))) * scale;
  const ticks = niceTicks(0, maxV * 1.08, 5);
  const sx = linear(0, ticks[ticks.length - 1], 0, iw);
  const [tip, setTip] = useState<TooltipState | null>(null);

  return (
    <div className="chart" ref={wrapRef}>
      <svg width={width} height={height} role="img" aria-label={rows.map((r) => `${r.label}: mean AUUC ${fmtNum(r.mean * scale, 2)}`).join('; ')}>
        <g transform={`translate(${m.left},${m.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={sx(t)} x2={sx(t)} y1={0} y2={rows.length * rowH} />
              <text x={sx(t)} y={rows.length * rowH + 16} textAnchor="middle">
                {fmtNum(t, t % 1 ? 1 : 0)}
              </text>
            </g>
          ))}
          <line className="baseline" x1={0} x2={0} y1={0} y2={rows.length * rowH} />
          {rows.map((r, i) => {
            const cy = i * rowH + rowH / 2;
            const mean = r.mean * scale;
            return (
              <g key={r.key}>
                <text x={-12} y={cy - 4} textAnchor="end" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fill: 'var(--ink)', fontWeight: 600 }}>
                  {r.label}
                </text>
                {r.note ? (
                  <text x={-12} y={cy + 11} textAnchor="end">
                    {r.note}
                  </text>
                ) : null}
                <rect x={0} y={cy - 5} width={Math.max(0, sx(mean) - 0)} height={10} fill={r.color} opacity={0.22} rx={0} />
                <rect x={Math.max(0, sx(mean) - 2)} y={cy - 11} width={2.5} height={22} fill={r.color} />
                {r.sd > 0 ? (
                  <line x1={sx(mean - r.sd * scale)} x2={sx(mean + r.sd * scale)} y1={cy + 15} y2={cy + 15} stroke="var(--amber)" strokeWidth={2} />
                ) : null}
                {r.values.map((v, j) => (
                  <circle
                    key={v.seed}
                    cx={sx(v.v * scale)}
                    cy={cy + (j - (r.values.length - 1) / 2) * 3}
                    r={r.values.length > 1 ? 4.5 : 0}
                    fill={r.color}
                    stroke="var(--surface)"
                    strokeWidth={1.5}
                    onPointerEnter={() =>
                      setTip({
                        x: m.left + sx(v.v * scale),
                        y: m.top + cy - 6,
                        content: (
                          <>
                            <div className="tooltip-title">{r.label}</div>
                            <div className="tooltip-row">
                              <span>Seed {v.seed}</span>
                              <b>{fmtNum(v.v * scale, 2)}</b>
                            </div>
                          </>
                        ),
                      })
                    }
                    onPointerLeave={() => setTip(null)}
                  />
                ))}
                <text x={iw + 8} y={cy} dy="0.32em" style={{ fill: 'var(--ink)', fontWeight: 600 }}>
                  {fmtNum(mean, 2)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ───────────────────────────── forest plot (measured CI + model estimate) ─────────────────────────────

export interface ForestRow {
  key: string;
  label: string;
  sub?: string;
  color: string;
  measured: { v: number; lo: number; hi: number };
  estimate?: { v: number; lo?: number; hi?: number } | null;
}

export function ForestPlot({ rows, unit, format, axisLabel, compact }: { rows: ForestRow[]; unit: string; format: (v: number) => string; axisLabel: string; compact?: boolean }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(640);
  const labelW = compact ? 0 : width < 520 ? 104 : 168;
  const rowH = compact ? 44 : 58;
  const m = { top: compact ? 6 : 10, right: 20, bottom: 36, left: labelW + (compact ? 12 : 8) };
  const iw = Math.max(60, width - m.left - m.right);
  const height = m.top + rows.length * rowH + m.bottom;
  const vals = rows.flatMap((r) => [r.measured.lo, r.measured.hi, r.measured.v, r.estimate?.v ?? 0, r.estimate?.lo ?? 0, r.estimate?.hi ?? 0, 0]);
  const pad = (Math.max(...vals) - Math.min(...vals)) * 0.08;
  const ticks = niceTicks(Math.min(...vals) - pad, Math.max(...vals) + pad, compact ? 4 : 6);
  const sx = linear(ticks[0], ticks[ticks.length - 1], 0, iw);
  const [tip, setTip] = useState<TooltipState | null>(null);

  return (
    <div className="chart" ref={wrapRef}>
      <svg width={width} height={height} role="img" aria-label={rows.map((r) => `${r.label}: measured ${format(r.measured.v)} (95% CI ${format(r.measured.lo)} to ${format(r.measured.hi)})${r.estimate ? `, model estimate ${format(r.estimate.v)}` : ''}`).join('; ')}>
        <g transform={`translate(${m.left},${m.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={sx(t)} x2={sx(t)} y1={0} y2={rows.length * rowH} />
              <text x={sx(t)} y={rows.length * rowH + 16} textAnchor="middle">
                {format(t)}
              </text>
            </g>
          ))}
          <line x1={sx(0)} x2={sx(0)} y1={-4} y2={rows.length * rowH + 4} stroke="var(--ink)" strokeWidth={1.25} />
          <text x={iw / 2} y={rows.length * rowH + 32} textAnchor="middle" className="axis-title">
            {axisLabel}
          </text>
          {rows.map((r, i) => {
            const cy = i * rowH + rowH / 2;
            const neg = r.measured.v < 0;
            const crosses = r.measured.lo < 0 && r.measured.hi > 0;
            const ciColor = crosses ? 'var(--amber)' : neg ? 'var(--coral)' : r.color;
            return (
              <g
                key={r.key}
                className="forest-row"
                onPointerEnter={() =>
                  setTip({
                    x: m.left + sx(r.measured.v),
                    y: m.top + cy - 10,
                    content: (
                      <>
                        <div className="tooltip-title">{r.label}</div>
                        <div className="tooltip-row">
                          <span>Measured</span>
                          <b>
                            {format(r.measured.v)} {unit}
                          </b>
                        </div>
                        <div className="tooltip-row">
                          <span>95% CI</span>
                          <b>
                            {format(r.measured.lo)} to {format(r.measured.hi)}
                          </b>
                        </div>
                        {r.estimate ? (
                          <div className="tooltip-row">
                            <span>Model estimate</span>
                            <b>{format(r.estimate.v)}</b>
                          </div>
                        ) : null}
                      </>
                    ),
                  })
                }
                onPointerLeave={() => setTip(null)}
              >
                <rect className="forest-bg" x={-m.left} y={i * rowH} width={width} height={rowH} fill="transparent" />
                {!compact ? (
                  <>
                    <text x={-12} y={cy - (r.sub ? 4 : 0)} dy={r.sub ? 0 : '0.32em'} textAnchor="end" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fill: 'var(--ink)', fontWeight: 600 }}>
                      {r.label}
                    </text>
                    {r.sub ? (
                      <text x={-12} y={cy + 11} textAnchor="end">
                        {r.sub}
                      </text>
                    ) : null}
                  </>
                ) : null}
                {r.estimate?.lo !== undefined && r.estimate?.hi !== undefined ? (
                  <rect x={sx(r.estimate.lo)} y={cy - 16} width={Math.max(2, sx(r.estimate.hi) - sx(r.estimate.lo))} height={6} fill="var(--amber-wash)" stroke="var(--amber)" strokeWidth={0.75} />
                ) : null}
                <line x1={sx(r.measured.lo)} x2={sx(r.measured.hi)} y1={cy} y2={cy} stroke={ciColor} strokeWidth={2.5} />
                <line x1={sx(r.measured.lo)} x2={sx(r.measured.lo)} y1={cy - 5} y2={cy + 5} stroke={ciColor} strokeWidth={2} />
                <line x1={sx(r.measured.hi)} x2={sx(r.measured.hi)} y1={cy - 5} y2={cy + 5} stroke={ciColor} strokeWidth={2} />
                <circle cx={sx(r.measured.v)} cy={cy} r={5.5} fill={neg ? 'var(--coral)' : 'var(--ink)'} stroke="var(--surface)" strokeWidth={2} />
                {r.estimate ? (
                  <rect x={sx(r.estimate.v) - 5} y={cy - 18} width={10} height={10} transform={`rotate(45 ${sx(r.estimate.v)} ${cy - 13})`} fill="var(--surface)" stroke="var(--teal)" strokeWidth={1.75} />
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}
