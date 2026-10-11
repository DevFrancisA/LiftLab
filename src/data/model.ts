// LiftLab mock data engine.
//
// Everything in the UI is derived from one seeded simulation of a randomized
// advertising experiment, so numbers agree across views:
//   - a held-out test split of N_TEST users, randomized 85/15 into ad / no-ad,
//   - per-user conversion outcomes drawn from a hidden baseline + true effect,
//   - five training seeds of a treatment-aware neural uplift model and of a
//     two-model (T-learner) baseline, simulated as noisy estimates of the truth.
// Measured quantities use only the randomized outcomes; model estimates use only
// the predicted scores. The two are never mixed.

import { clamp, gaussian, mean, mulberry32, quantile, sd } from './rng';

export type Archetype = 'Persuadable' | 'Sure thing' | 'Lost cause' | 'Do-not-disturb';

export interface SegmentDef {
  id: string;
  code: string;
  name: string;
  description: string;
  share: number;
  p0: number;
  tau: number;
  tauSd: number;
  archetype: Archetype;
  signals: string[];
}

export const SEGMENTS: SegmentDef[] = [
  { id: 's01', code: 'S01', name: 'Lapsed buyers · 90d+', description: 'Purchased before, no order in the last 90 days.', share: 0.09, p0: 0.018, tau: 0.03, tauSd: 0.012, archetype: 'Persuadable', signals: ['days since last order', 'past order count', 'email opens (90d)'] },
  { id: 's02', code: 'S02', name: 'Deal seekers · coupon users', description: 'Redeemed two or more promotions in the last year.', share: 0.08, p0: 0.032, tau: 0.034, tauSd: 0.014, archetype: 'Persuadable', signals: ['coupon redemptions', 'discount-page views', 'basket size'] },
  { id: 's03', code: 'S03', name: 'Cart abandoners · 7d', description: 'Added to cart in the last 7 days without checking out.', share: 0.07, p0: 0.085, tau: 0.026, tauSd: 0.015, archetype: 'Persuadable', signals: ['cart value', 'hours since cart event', 'checkout starts'] },
  { id: 's04', code: 'S04', name: 'Wishlist savers', description: 'Saved items to a wishlist in the last 30 days.', share: 0.05, p0: 0.046, tau: 0.022, tauSd: 0.012, archetype: 'Persuadable', signals: ['wishlist size', 'price-drop alerts', 'session depth'] },
  { id: 's05', code: 'S05', name: 'One-time buyers · 30–90d', description: 'Exactly one purchase, 30 to 90 days ago.', share: 0.08, p0: 0.027, tau: 0.019, tauSd: 0.01, archetype: 'Persuadable', signals: ['days since first order', 'category of first order', 'return visits'] },
  { id: 's06', code: 'S06', name: 'Price-comparison browsers', description: 'Arrive from comparison sites; long dwell on product specs.', share: 0.07, p0: 0.022, tau: 0.014, tauSd: 0.01, archetype: 'Persuadable', signals: ['referrer type', 'spec-tab dwell time', 'products compared'] },
  { id: 's07', code: 'S07', name: 'Dormant app installs', description: 'Installed the app but have not opened it in 30+ days.', share: 0.06, p0: 0.009, tau: 0.011, tauSd: 0.008, archetype: 'Persuadable', signals: ['days since app open', 'push opt-in', 'install source'] },
  { id: 's08', code: 'S08', name: 'Category browsers · home', description: 'Repeated home & garden browsing, no recent order.', share: 0.07, p0: 0.031, tau: 0.008, tauSd: 0.009, archetype: 'Persuadable', signals: ['category affinity', 'pages per session', 'seasonality index'] },
  { id: 's09', code: 'S09', name: 'Social referral visitors', description: 'First touch from a social platform in the last 14 days.', share: 0.06, p0: 0.015, tau: 0.006, tauSd: 0.008, archetype: 'Lost cause', signals: ['referrer type', 'bounce rate', 'device'] },
  { id: 's10', code: 'S10', name: 'New visitors · organic', description: 'First visit via organic search; no account.', share: 0.09, p0: 0.012, tau: 0.004, tauSd: 0.006, archetype: 'Lost cause', signals: ['landing page', 'query intent', 'device'] },
  { id: 's11', code: 'S11', name: 'Newsletter · unengaged', description: 'Subscribed, but no email opens in 60 days.', share: 0.05, p0: 0.01, tau: 0.003, tauSd: 0.006, archetype: 'Lost cause', signals: ['email opens (60d)', 'subscription age', 'unsubscribe risk'] },
  { id: 's12', code: 'S12', name: 'High-intent searchers', description: 'Branded search with product name in the last 48 hours.', share: 0.05, p0: 0.14, tau: 0.002, tauSd: 0.01, archetype: 'Sure thing', signals: ['branded query', 'hours since search', 'product-page views'] },
  { id: 's13', code: 'S13', name: 'Loyal repeat buyers', description: 'Five or more orders; ordered within the last 45 days.', share: 0.05, p0: 0.19, tau: -0.004, tauSd: 0.01, archetype: 'Sure thing', signals: ['order frequency', 'loyalty tier', 'days since last order'] },
  { id: 's14', code: 'S14', name: 'Low-engagement bouncers', description: 'Single-page sessions under 10 seconds.', share: 0.06, p0: 0.004, tau: 0.0005, tauSd: 0.003, archetype: 'Lost cause', signals: ['session length', 'bounce rate', 'traffic source'] },
  { id: 's15', code: 'S15', name: 'Recent purchasers · <14d', description: 'Completed an order in the last 14 days.', share: 0.04, p0: 0.06, tau: -0.012, tauSd: 0.008, archetype: 'Do-not-disturb', signals: ['days since last order', 'ad frequency (7d)', 'order value'] },
  { id: 's16', code: 'S16', name: 'Recent support contacts', description: 'Opened a support ticket in the last 30 days.', share: 0.03, p0: 0.045, tau: -0.016, tauSd: 0.009, archetype: 'Do-not-disturb', signals: ['open tickets', 'ticket sentiment', 'ad frequency (7d)'] },
];

export const DATA_SEED = 20260412;
export const N_TEST = 100000;
export const TREAT_SHARE = 0.8;
export const SEEDS = [11, 23, 37, 41, 59];
export const CURVE_POINTS = 50;
export const BOOTSTRAP_B = 400;

export const EXPERIMENT = {
  id: 'EXP-0412',
  name: 'Spring retargeting holdout',
  window: 'Mar 3 – Apr 13, 2026',
  split: 'Held-out test split',
};

export const MODEL_VERSION = {
  id: 'uplift-net',
  version: 'v2.3.1',
  seed: SEEDS[0],
};

export type ModelKey = 'uplift' | 'twoModel' | 'random';

export const MODEL_META: Record<ModelKey, { label: string; short: string; description: string }> = {
  uplift: {
    label: 'Neural uplift model',
    short: 'Uplift model',
    description: 'One network with a shared trunk and treatment-aware heads, trained to estimate the change in conversion probability caused by the ad.',
  },
  twoModel: {
    label: 'Two-model baseline',
    short: 'Two-model',
    description: 'Two separate conversion classifiers, one fit on users who saw the ad and one on users who did not; uplift is the difference of their predictions.',
  },
  random: {
    label: 'Random targeting',
    short: 'Random',
    description: 'Selects users at random. Its expected lift equals the average effect of the ad across everyone.',
  },
};

// ───────────────────────────── simulation ─────────────────────────────

export interface Population {
  n: number;
  seg: Uint8Array;
  p0: Float32Array;
  tau: Float32Array;
  treated: Uint8Array;
  y: Uint8Array;
  segCount: Int32Array;
}

export interface SeedRun {
  seed: number;
  p0Hat: Float32Array;
  tauHat: Float32Array;
  tauHatBase: Float32Array;
  order: Uint32Array;
  orderBase: Uint32Array;
  cumTau: Float64Array;
}

function simulatePopulation(): Population {
  const n = N_TEST;
  const rng = mulberry32(DATA_SEED);
  const z = gaussian(rng);
  const seg = new Uint8Array(n);
  const p0 = new Float32Array(n);
  const tau = new Float32Array(n);
  const treated = new Uint8Array(n);
  const y = new Uint8Array(n);
  const segCount = new Int32Array(SEGMENTS.length);

  let i = 0;
  SEGMENTS.forEach((s, si) => {
    const count = si === SEGMENTS.length - 1 ? n - i : Math.round(s.share * n);
    segCount[si] = count;
    for (let c = 0; c < count; c++, i++) {
      seg[i] = si;
      const base = clamp(s.p0 * Math.exp(0.35 * z()), 0.0005, 0.6);
      const effect = clamp(s.tau + s.tauSd * z(), -base, 0.95 - base);
      p0[i] = base;
      tau[i] = effect;
      const t = rng() < TREAT_SHARE ? 1 : 0;
      treated[i] = t;
      y[i] = rng() < base + t * effect ? 1 : 0;
    }
  });
  return { n, seg, p0, tau, treated, y, segCount };
}

function rankDesc(scores: Float32Array): Uint32Array {
  const idx = new Uint32Array(scores.length);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  idx.sort((a, b) => scores[b] - scores[a] || a - b);
  return idx;
}

function trainSeed(pop: Population, seed: number): SeedRun {
  const rng = mulberry32(seed * 7919 + 13);
  const z = gaussian(rng);
  const nSeg = SEGMENTS.length;
  const bias = Array.from({ length: nSeg }, () => 0.0015 * z());
  const biasBase = Array.from({ length: nSeg }, () => 0.004 * z());

  const p0Hat = new Float32Array(pop.n);
  const tauHat = new Float32Array(pop.n);
  const tauHatBase = new Float32Array(pop.n);
  for (let i = 0; i < pop.n; i++) {
    const s = pop.seg[i];
    const p0 = pop.p0[i];
    const p1 = p0 + pop.tau[i];
    const p0h = clamp(p0 * Math.exp(0.1 * z()), 0.0003, 0.7);
    p0Hat[i] = p0h;
    // Neural uplift: a direct, shrunk estimate of the effect with modest noise.
    tauHat[i] = clamp(0.88 * pop.tau[i] + 0.12 * SEGMENTS[s].tau + bias[s] + 0.0075 * z(), -p0h, 0.9 - p0h);
    // Two-model: difference of two independently fit probabilities. Relative
    // errors in each head do not cancel, so high-baseline users get noisy uplift.
    const e0 = 0.29 * z();
    const e1 = 0.29 * z();
    tauHatBase[i] = p1 * (1 + e1) - p0 * (1 + e0) + biasBase[s] + 0.006 * z();
  }
  const order = rankDesc(tauHat);
  const orderBase = rankDesc(tauHatBase);
  const cumTau = new Float64Array(pop.n + 1);
  for (let k = 0; k < pop.n; k++) cumTau[k + 1] = cumTau[k] + tauHat[order[k]];
  return { seed, p0Hat, tauHat, tauHatBase, order, orderBase, cumTau };
}

function randomOrder(n: number, seed: number): Uint32Array {
  const rng = mulberry32(seed);
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  return idx;
}

// ───────────────────────────── measurement ─────────────────────────────

export interface Curve {
  x: number[];
  y: number[]; // measured incremental conversions per user in the full split
  auuc: number;
}

/** Measured uplift curve: at each fraction targeted, (treated rate − control rate) × users targeted, divided by N. */
export function measuredCurve(pop: Population, order: Uint32Array, points = CURVE_POINTS): Curve {
  const x = [0];
  const y = [0];
  let yt = 0;
  let nt = 0;
  let yc = 0;
  let nc = 0;
  let next = 1;
  for (let k = 0; k < pop.n; k++) {
    const i = order[k];
    if (pop.treated[i]) {
      nt++;
      yt += pop.y[i];
    } else {
      nc++;
      yc += pop.y[i];
    }
    const boundary = Math.round((next / points) * pop.n);
    if (k + 1 === boundary) {
      const diff = nt > 0 && nc > 0 ? yt / nt - yc / nc : 0;
      x.push(next / points);
      y.push((diff * (k + 1)) / pop.n);
      next++;
    }
  }
  return { x, y, auuc: trapezoid(x, y) };
}

function trapezoid(x: number[], y: number[]): number {
  let a = 0;
  for (let i = 1; i < x.length; i++) a += ((x[i] - x[i - 1]) * (y[i] + y[i - 1])) / 2;
  return a;
}

export interface PolicyEval {
  k: number;
  nt: number;
  nc: number;
  rateT: number;
  rateC: number;
  per1k: number;
  incremental: number;
  ci: [number, number];
  boots: Float64Array;
}

/** Bootstrap the targeted set (resampling users with replacement) to get a 95% CI on incremental conversions per 1,000 targeted. */
export function evaluatePolicy(pop: Population, order: Uint32Array, k: number, seed: number, B = BOOTSTRAP_B): PolicyEval {
  let yt = 0;
  let nt = 0;
  let yc = 0;
  let nc = 0;
  for (let r = 0; r < k; r++) {
    const i = order[r];
    if (pop.treated[i]) {
      nt++;
      yt += pop.y[i];
    } else {
      nc++;
      yc += pop.y[i];
    }
  }
  const rateT = nt ? yt / nt : 0;
  const rateC = nc ? yc / nc : 0;
  const per1k = (rateT - rateC) * 1000;
  const rng = mulberry32(seed);
  const boots = new Float64Array(B);
  for (let b = 0; b < B; b++) {
    let byt = 0;
    let bnt = 0;
    let byc = 0;
    let bnc = 0;
    for (let r = 0; r < k; r++) {
      const i = order[Math.floor(rng() * k)];
      if (pop.treated[i]) {
        bnt++;
        byt += pop.y[i];
      } else {
        bnc++;
        byc += pop.y[i];
      }
    }
    boots[b] = bnt && bnc ? (byt / bnt - byc / bnc) * 1000 : 0;
  }
  const sorted = Float64Array.from(boots).sort();
  return {
    k,
    nt,
    nc,
    rateT,
    rateC,
    per1k,
    incremental: (per1k * k) / 1000,
    ci: [quantile(sorted, 0.025), quantile(sorted, 0.975)],
    boots,
  };
}

export function diffCI(a: PolicyEval, b: PolicyEval): { diff: number; ci: [number, number] } {
  const B = Math.min(a.boots.length, b.boots.length);
  const d = new Float64Array(B);
  for (let i = 0; i < B; i++) d[i] = a.boots[i] - b.boots[i];
  d.sort();
  return { diff: a.per1k - b.per1k, ci: [quantile(d, 0.025), quantile(d, 0.975)] };
}

// ───────────────────────────── segment & balance ─────────────────────────────

export interface SegmentStats {
  def: SegmentDef;
  index: number;
  n: number;
  pNoAd: number;
  pAd: number;
  uplift: number;
  seedRange: [number, number];
  seedUplifts: number[];
  measured: { nt: number; nc: number; rateT: number; rateC: number; diff: number; ci: [number, number] };
}

function segmentStats(pop: Population, runs: SeedRun[]): SegmentStats[] {
  const nSeg = SEGMENTS.length;
  const sumP0 = new Float64Array(nSeg);
  const sumTauBySeed = runs.map(() => new Float64Array(nSeg));
  const yt = new Float64Array(nSeg);
  const nt = new Float64Array(nSeg);
  const yc = new Float64Array(nSeg);
  const nc = new Float64Array(nSeg);
  const primary = runs[0];
  for (let i = 0; i < pop.n; i++) {
    const s = pop.seg[i];
    sumP0[s] += primary.p0Hat[i];
    runs.forEach((r, ri) => (sumTauBySeed[ri][s] += r.tauHat[i]));
    if (pop.treated[i]) {
      nt[s]++;
      yt[s] += pop.y[i];
    } else {
      nc[s]++;
      yc[s] += pop.y[i];
    }
  }
  return SEGMENTS.map((def, s) => {
    const n = pop.segCount[s];
    const seedUplifts = sumTauBySeed.map((a) => a[s] / n);
    const pNoAd = sumP0[s] / n;
    const uplift = seedUplifts[0];
    const rateT = yt[s] / nt[s];
    const rateC = yc[s] / nc[s];
    const se = Math.sqrt((rateT * (1 - rateT)) / nt[s] + (rateC * (1 - rateC)) / nc[s]);
    const diff = rateT - rateC;
    return {
      def,
      index: s,
      n,
      pNoAd,
      pAd: pNoAd + uplift,
      uplift,
      seedUplifts,
      seedRange: [Math.min(...seedUplifts), Math.max(...seedUplifts)],
      measured: { nt: nt[s], nc: nc[s], rateT, rateC, diff, ci: [diff - 1.96 * se, diff + 1.96 * se] },
    };
  });
}

export interface BalanceRow {
  label: string;
  treated: number;
  control: number;
  smd: number;
}

export interface Balance {
  nt: number;
  nc: number;
  treatedShare: number;
  rows: BalanceRow[];
  maxAbsSmd: number;
}

function balance(pop: Population): Balance {
  const nSeg = SEGMENTS.length;
  const ct = new Float64Array(nSeg);
  const cc = new Float64Array(nSeg);
  let nt = 0;
  let nc = 0;
  for (let i = 0; i < pop.n; i++) {
    if (pop.treated[i]) {
      nt++;
      ct[pop.seg[i]]++;
    } else {
      nc++;
      cc[pop.seg[i]]++;
    }
  }
  const rows = SEGMENTS.map((s, si) => {
    const a = ct[si] / nt;
    const b = cc[si] / nc;
    const pooled = Math.sqrt((a * (1 - a) + b * (1 - b)) / 2);
    return { label: `${s.code} ${s.name}`, treated: a, control: b, smd: pooled > 0 ? (a - b) / pooled : 0 };
  });
  return { nt, nc, treatedShare: nt / pop.n, rows, maxAbsSmd: Math.max(...rows.map((r) => Math.abs(r.smd))) };
}

// ───────────────────────────── assembled dataset ─────────────────────────────

export interface SeedSummary {
  seed: number;
  auuc: Record<ModelKey, number>;
}

export interface Dataset {
  pop: Population;
  runs: SeedRun[];
  primary: SeedRun;
  randomOrder: Uint32Array;
  curves: Record<ModelKey, Curve>;
  seedCurves: { uplift: Curve[]; twoModel: Curve[] };
  seedSummaries: SeedSummary[];
  auucStats: Record<ModelKey, { mean: number; sd: number; values: number[] }>;
  ateMeasured: number;
  segments: SegmentStats[];
  balance: Balance;
  totalEstimated: number;
  placebo: { auuc: number; ate: number };
}

export function buildDataset(): Dataset {
  const pop = simulatePopulation();
  const runs = SEEDS.map((s) => trainSeed(pop, s));
  const primary = runs[0];
  const rOrder = randomOrder(pop.n, DATA_SEED + 1);
  const seedCurves = {
    uplift: runs.map((r) => measuredCurve(pop, r.order)),
    twoModel: runs.map((r) => measuredCurve(pop, r.orderBase)),
  };
  const random = measuredCurve(pop, rOrder);
  const ateMeasured = random.y[random.y.length - 1];
  // Random targeting's expected curve is the straight line to the overall effect.
  const randomLine: Curve = { x: random.x, y: random.x.map((x) => x * ateMeasured), auuc: ateMeasured / 2 };
  const seedSummaries = runs.map((r, i) => ({
    seed: r.seed,
    auuc: { uplift: seedCurves.uplift[i].auuc, twoModel: seedCurves.twoModel[i].auuc, random: randomLine.auuc },
  }));
  // Placebo: shuffle who "saw the ad". A sound pipeline should find no lift.
  const perm = randomOrder(pop.n, DATA_SEED + 2);
  const shuffled = new Uint8Array(pop.n);
  for (let i = 0; i < pop.n; i++) shuffled[i] = pop.treated[perm[i]];
  const placeboCurve = measuredCurve({ ...pop, treated: shuffled }, primary.order);
  const stat = (values: number[]) => ({ mean: mean(values), sd: values.length > 1 ? sd(values) : 0, values });
  return {
    pop,
    runs,
    primary,
    randomOrder: rOrder,
    curves: { uplift: seedCurves.uplift[0], twoModel: seedCurves.twoModel[0], random: randomLine },
    seedCurves,
    seedSummaries,
    auucStats: {
      uplift: stat(seedSummaries.map((s) => s.auuc.uplift)),
      twoModel: stat(seedSummaries.map((s) => s.auuc.twoModel)),
      random: stat(seedSummaries.map((s) => s.auuc.random)),
    },
    ateMeasured,
    segments: segmentStats(pop, runs),
    balance: balance(pop),
    totalEstimated: primary.cumTau[pop.n],
    placebo: { auuc: placeboCurve.auuc, ate: placeboCurve.y[placeboCurve.y.length - 1] },
  };
}

// ───────────────────────────── budget-dependent selection ─────────────────────────────

export type Recommendation = 'Target' | 'Partial' | 'Hold' | 'Avoid';

export interface Selection {
  budget: number;
  k: number;
  threshold: number;
  estIncremental: number;
  estRange: [number, number];
  randomIncremental: number;
  pNoAd: number;
  pAd: number;
  restNoAd: number;
  restAd: number;
  peakBudget: number;
  segShare: number[];
  segRec: Recommendation[];
}

export function budgetToK(budget: number, n: number): number {
  return Math.max(1, Math.min(n, Math.round(budget * n)));
}

export function select(ds: Dataset, budget: number): Selection {
  const { pop, primary, runs } = ds;
  const k = budgetToK(budget, pop.n);
  let sumP0 = 0;
  const segIn = new Float64Array(SEGMENTS.length);
  for (let r = 0; r < k; r++) {
    const i = primary.order[r];
    sumP0 += primary.p0Hat[i];
    segIn[pop.seg[i]]++;
  }
  let totalP0 = 0;
  for (let i = 0; i < pop.n; i++) totalP0 += primary.p0Hat[i];
  const estIncremental = primary.cumTau[k];
  const seedVals = runs.map((r) => r.cumTau[k]);
  const pNoAd = sumP0 / k;
  const restN = pop.n - k;
  const restNoAd = restN > 0 ? (totalP0 - sumP0) / restN : NaN;
  const restAd = restN > 0 ? (totalP0 - sumP0 + ds.totalEstimated - estIncremental) / restN : NaN;
  const segShare = Array.from(segIn, (c, s) => c / pop.segCount[s]);
  const segRec = ds.segments.map((s, si): Recommendation => {
    if (s.uplift < 0) return 'Avoid';
    if (segShare[si] >= 0.5) return 'Target';
    if (segShare[si] >= 0.1) return 'Partial';
    return 'Hold';
  });
  return {
    budget,
    k,
    threshold: primary.tauHat[primary.order[k - 1]],
    estIncremental,
    estRange: [Math.min(...seedVals), Math.max(...seedVals)],
    randomIncremental: (ds.totalEstimated * k) / pop.n,
    pNoAd,
    pAd: pNoAd + estIncremental / k,
    restNoAd,
    restAd,
    peakBudget: peakOf(primary.cumTau) / pop.n,
    segShare,
    segRec,
  };
}

function peakOf(cum: Float64Array): number {
  let best = 0;
  for (let k = 1; k < cum.length; k++) if (cum[k] > cum[best]) best = k;
  return best;
}

/** Model-estimated cumulative curve, sampled for drawing. */
export function estimatedCurve(ds: Dataset, run: SeedRun, points = 200): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let j = 0; j <= points; j++) {
    const k = Math.round((j / points) * ds.pop.n);
    x.push(j / points);
    y.push(run.cumTau[k]);
  }
  return { x, y };
}

export interface PolicyComparison {
  budget: number;
  k: number;
  uplift: PolicyEval;
  twoModel: PolicyEval;
  random: PolicyEval;
  estimate: { uplift: number; twoModel: number };
  vsRandom: { uplift: { diff: number; ci: [number, number] }; twoModel: { diff: number; ci: [number, number] } };
}

export function comparePolicies(ds: Dataset, budget: number): PolicyComparison {
  const k = budgetToK(budget, ds.pop.n);
  const p = ds.primary;
  const uplift = evaluatePolicy(ds.pop, p.order, k, 101);
  const twoModel = evaluatePolicy(ds.pop, p.orderBase, k, 202);
  const random = evaluatePolicy(ds.pop, ds.randomOrder, k, 303);
  let estBase = 0;
  for (let r = 0; r < k; r++) estBase += p.tauHatBase[p.orderBase[r]];
  return {
    budget,
    k,
    uplift,
    twoModel,
    random,
    estimate: { uplift: (p.cumTau[k] / k) * 1000, twoModel: (estBase / k) * 1000 },
    vsRandom: { uplift: diffCI(uplift, random), twoModel: diffCI(twoModel, random) },
  };
}
