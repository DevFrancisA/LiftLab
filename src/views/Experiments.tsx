import { useEffect, useRef, useState } from 'react';
import { ForestPlot, SERIES } from '../components/charts';
import { BlockHead, Callout, Disclosure, ErrorState, Icon, InlineLoading, Kind, Metric, PageHead, Tabs } from '../components/ui';
import { BOOTSTRAP_B, EXPERIMENT, MODEL_META, comparePolicies, type PolicyComparison } from '../data/model';
import { fmtInt, fmtNum, fmtPct, fmtSigned } from '../format';
import { useReady } from '../state';

const BUDGETS = ['10', '20', '30', '50'] as const;
type BudgetTab = (typeof BUDGETS)[number];

export function Experiments() {
  const { ds } = useReady();
  const [tab, setTab] = useState<BudgetTab>('20');
  const cache = useRef(new Map<string, PolicyComparison>());
  const [result, setResult] = useState<PolicyComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const hit = cache.current.get(tab);
    if (hit) {
      setResult(hit);
      return;
    }
    setResult(null);
    setError(null);
    // Yield a frame so the loading state paints before the bootstrap runs.
    const t = window.setTimeout(() => {
      try {
        const r = comparePolicies(ds, Number(tab) / 100);
        cache.current.set(tab, r);
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 30);
    return () => window.clearTimeout(t);
  }, [ds, tab, attempt]);

  const bal = ds.balance;

  return (
    <div className="view-enter">
      <PageHead
        num="03"
        section="Experiments"
        aside={<span className="tag">{EXPERIMENT.id}</span>}
        title="Does uplift targeting beat the alternatives?"
        lede="Three targeting policies get the same budget. Because ad exposure was randomized, comparing people who saw the ad with those held out shows what each policy actually achieved on the test split."
      />

      <div className="grid-2-even" style={{ marginBottom: 20 }}>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <Kind type="measured">Measured experiment outcome</Kind>
          <p className="note" style={{ margin: '6px 0 0' }}>
            Within each policy&rsquo;s selected users: conversion rate of those randomly shown the ad minus those randomly held out. Uncertainty from a bootstrap ({BOOTSTRAP_B} resamples), 95% interval.
          </p>
        </div>
        <div className="panel" style={{ padding: '14px 18px' }}>
          <Kind type="estimate">Model estimate</Kind>
          <p className="note" style={{ margin: '6px 0 0' }}>
            What the policy&rsquo;s own model predicted for the same users, before looking at outcomes. A gap between estimate and measurement means the model is miscalibrated.
          </p>
        </div>
      </div>

      <section className="panel" aria-labelledby="pol-h">
        <BlockHead
          num="3.1"
          id="pol-h"
          title="Incremental conversions per 1,000 targeted"
          sub="Same budget for every policy. Points to the right of zero mean the ad created conversions."
          right={
            <div className="field">
              <span className="field-label" id="exp-budget-label">
                Targeting budget
              </span>
              <Tabs variant="segmented" label="Targeting budget" idBase="exp-budget" value={tab} onChange={setTab} tabs={BUDGETS.map((b) => ({ id: b, label: `${b}%` }))} />
            </div>
          }
        />
        <div id="exp-budget-panel" role="tabpanel" aria-labelledby={`exp-budget-tab-${tab}`}>
          {error ? (
            <ErrorState title="Couldn't run the bootstrap" message={error} onRetry={() => setAttempt((a) => a + 1)} />
          ) : !result ? (
            <InlineLoading label={`Bootstrapping ${BOOTSTRAP_B} resamples for 3 policies at ${tab}%…`} height={230} />
          ) : (
            <PolicyResults r={result} />
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="bal-h">
        <BlockHead
          num="3.2"
          id="bal-h"
          title="Randomization check"
          sub="If ad exposure was truly random, people who saw the ad and people held out should look alike before the campaign."
          right={
            <span className={`badge ${bal.maxAbsSmd < 0.1 ? 'badge-target' : 'badge-avoid'}`}>
              <Icon name={bal.maxAbsSmd < 0.1 ? 'check' : 'alert'} size={12} />
              {bal.maxAbsSmd < 0.1 ? 'Balanced' : 'Imbalance detected'}
            </span>
          }
        />
        <div className="metric-strip">
          <Metric label="Saw the ad" value={fmtInt(bal.nt)} help={`${fmtPct(bal.treatedShare)} of the test split`} kind="measured" />
          <Metric label="Held out" value={fmtInt(bal.nc)} help={`${fmtPct(1 - bal.treatedShare)}; design target 20%`} kind="measured" />
          <Metric label="Largest imbalance" value={fmtNum(bal.maxAbsSmd, 3)} unit="|SMD|" help="Standardized mean difference across segment shares. Below 0.1 is considered balanced." />
        </div>
        <div style={{ marginTop: 14 }}>
          <Disclosure num="↳" title="Balance by segment" sub="Share of each group that falls in each segment">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Segment</th>
                    <th scope="col" className="is-num">
                      Saw ad
                    </th>
                    <th scope="col" className="is-num">
                      Held out
                    </th>
                    <th scope="col" className="is-num">
                      SMD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bal.rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="is-num">{fmtPct(r.treated, 2)}</td>
                      <td className="is-num">{fmtPct(r.control, 2)}</td>
                      <td className="is-num">{fmtSigned(r.smd, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
          <Disclosure num="↳" title="How measured lift is computed" sub="Offline policy evaluation on randomized data">
            <p>
              Each policy ranks the {fmtInt(ds.pop.n)} test users and keeps the top share. Because the ad was assigned at random (80% shown, 20% held out) <em>before</em> any model existed, the held-out users inside that selection are a fair stand-in for what the shown users
              would have done without the ad.
            </p>
            <p>
              Measured lift = conversion rate (shown) − conversion rate (held out), multiplied by 1,000. The 95% interval comes from resampling the selected users with replacement {BOOTSTRAP_B} times and taking the 2.5th and 97.5th percentiles. Differences between policies subtract
              the two policies&rsquo; bootstrap draws, one pair at a time.
            </p>
            <p>The test split was never used for training, tuning, or early stopping.</p>
          </Disclosure>
        </div>
      </section>
    </div>
  );
}

function PolicyResults({ r }: { r: PolicyComparison }) {
  const pct = Math.round(r.budget * 100);
  const keys = ['uplift', 'twoModel', 'random'] as const;
  const rows = keys.map((k) => ({
    key: k,
    label: MODEL_META[k].short,
    sub: k === 'random' ? 'no model' : k === 'uplift' ? 'LiftLab' : 'baseline',
    color: SERIES[k],
    measured: { v: r[k].per1k, lo: r[k].ci[0], hi: r[k].ci[1] },
    estimate: k === 'random' ? null : { v: r.estimate[k] },
  }));
  const vs = r.vsRandom.uplift;
  const vsBase = { diff: r.uplift.per1k - r.twoModel.per1k };
  const gapBase = r.estimate.twoModel - r.twoModel.per1k;
  const gapUp = r.estimate.uplift - r.uplift.per1k;
  const vsPositive = vs.ci[0] > 0;

  return (
    <>
      <ForestPlot rows={rows} unit="per 1k" format={(v) => fmtNum(v, 0)} axisLabel="Incremental conversions per 1,000 targeted" />
      <div className="split-label">
        <Kind type="measured">Measured · line = 95% bootstrap CI</Kind>
        <Kind type="estimate">Model estimate</Kind>
        <span className="note" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="tooltip-key" style={{ background: 'var(--amber)' }} /> amber interval = includes zero
        </span>
      </div>

      <div className="metric-strip" style={{ marginTop: 6 }}>
        <Metric
          kind="measured"
          label={`Uplift targeting @ ${pct}%`}
          value={fmtNum(r.uplift.per1k, 1)}
          unit="per 1k"
          range={`95% CI ${fmtNum(r.uplift.ci[0], 1)} to ${fmtNum(r.uplift.ci[1], 1)}`}
          help={`≈ ${fmtInt(r.uplift.incremental)} incremental conversions among ${fmtInt(r.k)} targeted users.`}
        />
        <Metric
          kind="measured"
          label="Gain over random"
          value={fmtSigned(vs.diff, 1)}
          unit="per 1k"
          range={`95% CI ${fmtSigned(vs.ci[0], 1)} to ${fmtSigned(vs.ci[1], 1)}`}
          help={vsPositive ? 'The interval excludes zero: uplift targeting beats random at this budget.' : 'The interval includes zero: the advantage is not yet distinguishable from chance.'}
        />
        <Metric kind="measured" label="Gain over two-model" value={fmtSigned(vsBase.diff, 1)} unit="per 1k" help="Same users, same budget. Both models trained on identical features." />
      </div>

      {gapBase > Math.max(5, Math.abs(gapUp) * 2) ? (
        <Callout tone="uncertain">
          The two-model baseline predicted {fmtNum(r.estimate.twoModel, 1)} per 1,000 but measured {fmtNum(r.twoModel.per1k, 1)}. Subtracting two separately trained probability models compounds their errors, so it overstates uplift for the people it ranks highest. LiftLab&rsquo;s
          estimate ({fmtNum(r.estimate.uplift, 1)}) lands within {fmtNum(Math.abs(gapUp), 1)} of its measured result.
        </Callout>
      ) : null}

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table className="table">
          <caption className="sr-only">Policy comparison at {pct}% budget</caption>
          <thead>
            <tr>
              <th scope="col">Policy</th>
              <th scope="col" className="is-num">
                Shown / held out
              </th>
              <th scope="col" className="is-num">
                Conv. with ad
              </th>
              <th scope="col" className="is-num">
                Conv. without
              </th>
              <th scope="col" className="is-num">
                Measured / 1k
              </th>
              <th scope="col" className="is-num">
                95% CI
              </th>
              <th scope="col" className="is-num">
                Estimate / 1k
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                    <i className="tooltip-key" style={{ background: SERIES[k] }} />
                    {MODEL_META[k].label}
                  </span>
                </td>
                <td className="is-num">
                  {fmtInt(r[k].nt)} / {fmtInt(r[k].nc)}
                </td>
                <td className="is-num">{fmtPct(r[k].rateT, 2)}</td>
                <td className="is-num">{fmtPct(r[k].rateC, 2)}</td>
                <td className="is-num" style={{ fontWeight: 600 }}>
                  {fmtNum(r[k].per1k, 1)}
                </td>
                <td className="is-num">
                  {fmtNum(r[k].ci[0], 1)} to {fmtNum(r[k].ci[1], 1)}
                </td>
                <td className="is-num" style={{ color: 'var(--teal-ink)' }}>
                  {k === 'random' ? '—' : fmtNum(r.estimate[k], 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ margin: '10px 0 0' }}>
        Offline evaluation on the held-out split of {EXPERIMENT.id} (mock data). Results describe this test sample, not projected campaign revenue.
      </p>
    </>
  );
}
