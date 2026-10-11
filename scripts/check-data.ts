// Sanity checks for the mock data engine: run with `npm run check:data`.
import { buildDataset, comparePolicies, select, SEGMENTS } from '../src/data/model';

const t0 = performance.now();
const ds = buildDataset();
const t1 = performance.now();
const f = (x: number, d = 4) => x.toFixed(d);
console.log(`build ${f(t1 - t0, 0)} ms`);
console.log('ATE measured', f(ds.ateMeasured), 'total est', f(ds.totalEstimated, 1), '=', f(ds.totalEstimated / ds.pop.n));
for (const m of ['uplift', 'twoModel', 'random'] as const) {
  const s = ds.auucStats[m];
  console.log(m, 'AUUC mean', f(s.mean, 5), 'sd', f(s.sd, 5), s.values.map((v) => f(v, 5)).join(' '));
}
console.log('AUUC ratio uplift/twoModel', f(ds.auucStats.uplift.mean / ds.auucStats.twoModel.mean, 3));
console.log('balance', ds.balance.nt, ds.balance.nc, f(ds.balance.treatedShare), 'max|SMD|', f(ds.balance.maxAbsSmd));
const t2 = performance.now();
const pc = comparePolicies(ds, 0.2);
console.log(`compare ${f(performance.now() - t2, 0)} ms`);
for (const m of ['uplift', 'twoModel', 'random'] as const) {
  const e = pc[m];
  console.log(m, 'per1k', f(e.per1k, 1), 'CI', f(e.ci[0], 1), f(e.ci[1], 1), 'incr', f(e.incremental, 0), 'nt/nc', e.nt, e.nc);
}
console.log('estimate per1k', f(pc.estimate.uplift, 1), f(pc.estimate.twoModel, 1));
console.log('vs random', f(pc.vsRandom.uplift.diff, 1), pc.vsRandom.uplift.ci.map((v) => f(v, 1)));
for (const b of [0.05, 0.1, 0.2, 0.5, 0.9, 1]) {
  const s = select(ds, b);
  console.log(`b=${b}`, 'k', s.k, 'thr', f(s.threshold), 'est', f(s.estIncremental, 0), s.estRange.map((v) => f(v, 0)), 'rand', f(s.randomIncremental, 0), 'p0', f(s.pNoAd), 'p1', f(s.pAd), 'peak', f(s.peakBudget, 3));
}
const s20 = select(ds, 0.2);
for (const seg of ds.segments) {
  console.log(seg.def.code, seg.def.name.padEnd(28), 'n', seg.n, 'p0', f(seg.pNoAd), 'p1', f(seg.pAd), 'up', f(seg.uplift), 'meas', f(seg.measured.diff), seg.measured.ci.map((v) => f(v)).join(','), 'share@20', f(s20.segShare[seg.index], 2), s20.segRec[seg.index]);
}
void SEGMENTS;
console.log('placebo', ds.placebo, 'vs uplift seed0', ds.curves.uplift.auuc);
