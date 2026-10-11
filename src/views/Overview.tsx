import { useMemo } from 'react';
import { UpliftCurveChart } from '../components/charts';
import { Versus } from '../components/compare';
import { BlockHead, BudgetControl, Callout, Disclaimer, Icon, Kind, Metric, PageHead } from '../components/ui';
import { EXPERIMENT } from '../data/model';
import { fmtInt, fmtNum, fmtPP, fmtPct } from '../format';
import { useReady } from '../state';

export function Overview({ go }: { go: (path: string) => void }) {
  const { ds, selection: sel, budget, setBudget } = useReady();
  const n = ds.pop.n;
  const per1k = (sel.estIncremental / sel.k) * 1000;
  const multiple = sel.randomIncremental > 0 ? sel.estIncremental / sel.randomIncremental : NaN;
  const pastPeak = sel.budget > sel.peakBudget + 0.005;
  const marginalSmall = !pastPeak && sel.threshold < 0.005;
  const peakPct = Math.round(sel.peakBudget * 100);

  const reco = useMemo(() => {
    const ranked = ds.segments
      .map((s) => ({ s, inSel: sel.segShare[s.index] * s.n, share: sel.segShare[s.index] }))
      .filter((r) => r.share >= 0.1 && r.s.uplift > 0)
      .sort((a, b) => b.inSel - a.inSel);
    const avoid = ds.segments.filter((s) => sel.segRec[s.index] === 'Avoid');
    const topShare = ranked.slice(0, 3).reduce((a, r) => a + r.inSel, 0) / sel.k;
    return { ranked, avoid, topShare };
  }, [ds, sel]);

  return (
    <div className="view-enter">
      <PageHead
        num="01"
        section="Overview"
        aside={<span className="tag">{EXPERIMENT.id}</span>}
        title={
          <>
            Where will your next advertising dollar <em>make a difference?</em>
          </>
        }
        lede="LiftLab ranks people by estimated uplift: how much seeing the ad changes their chance of converting. Budget goes to the people the ad persuades, not to those who would convert anyway."
      />

      <section aria-labelledby="budget-h" style={{ marginBottom: 20 }}>
        <h2 id="budget-h" className="sr-only">
          Targeting budget
        </h2>
        <BudgetControl value={budget} onChange={setBudget} help={`Share of the ${fmtInt(n)}-user test split that sees the ad. Drag here or on the curve.`} />
      </section>

      <div className="grid-2">
        <section className="panel" aria-labelledby="curve-h">
          <BlockHead num="1.1" id="curve-h" title="Uplift curve" sub="Incremental conversions as you target more of the audience, most persuadable first. The shaded area is your selected audience." right={<Kind type="estimate" />} />
          <UpliftCurveChart ds={ds} selection={sel} budget={budget} onBudget={setBudget} />
          <p className="note" style={{ margin: '10px 0 0' }}>
            Tip: drag the cutoff handle, click anywhere on the chart, or focus the handle and use ← → (Shift for steps of 10).
          </p>
        </section>

        <section aria-labelledby="sel-h" className="stack">
          <div>
            <BlockHead num="1.2" id="sel-h" title="Selected audience" right={<Kind type="estimate" />} />
            <div className="metrics" aria-live="polite">
              <Metric label="Audience size" value={fmtInt(sel.k)} unit="users" help={`Top ${budget}% of the test split by predicted uplift.`} />
              <Metric
                label="Incremental conversions"
                kind="estimate"
                value={fmtInt(sel.estIncremental)}
                range={`${fmtInt(sel.estRange[0])}–${fmtInt(sel.estRange[1])} across 5 seeds`}
                help="Conversions the ad is estimated to cause, beyond those that happen anyway."
              />
              <Metric label="Per 1,000 targeted" kind="estimate" value={fmtNum(per1k, 1)} help="Incremental conversions for every 1,000 people shown the ad." />
              <Metric
                label="vs. random targeting"
                kind="estimate"
                value={Number.isFinite(multiple) ? `${fmtNum(multiple, 2)}×` : '—'}
                help={`Random targeting at ${budget}% would yield about ${fmtInt(sel.randomIncremental)}.`}
              />
            </div>
          </div>
          <div className="panel" style={{ padding: '16px 18px' }}>
            <p className="metric-label" style={{ marginBottom: 8 }}>
              Marginal user at cutoff
            </p>
            <div className="metric-value" style={{ fontSize: 22 }}>
              <span className={sel.threshold < 0 ? 'is-neg' : undefined}>{fmtPP(sel.threshold, 2)}</span>
            </div>
            <p className="metric-help">
              Estimated uplift of the last person included. When it reaches zero (at {peakPct}%), adding more people stops helping.
            </p>
          </div>
        </section>
      </div>

      <section aria-labelledby="vs-h" style={{ marginTop: 28 }}>
        <BlockHead
          num="1.3"
          id="vs-h"
          title="Conversion with vs. without advertising"
          sub={`Average predicted conversion probability for the ${fmtInt(sel.k)} people in your selected audience.`}
          right={<Kind type="estimate" />}
        />
        <Versus
          pNoAd={sel.pNoAd}
          pAd={sel.pAd}
          caption={<>For the selected audience,</>}
          footnote={
            Number.isFinite(sel.restNoAd) ? (
              <>
                For contrast, the {fmtInt(n - sel.k)} people left out: {fmtPct(sel.restNoAd)} without the ad vs. {fmtPct(sel.restAd)} with it ({fmtPP(sel.restAd - sel.restNoAd)}).
              </>
            ) : (
              <>Everyone in the test split is targeted.</>
            )
          }
        />
      </section>

      <section aria-labelledby="reco-h" className="panel" style={{ marginTop: 28 }}>
        <BlockHead num="1.4" id="reco-h" title="Recommendation" right={<span className="tag is-teal">At {budget}% budget</span>} />
        <div className={`reco${pastPeak ? ' is-warning' : ''}`}>
          <h3>
            {pastPeak
              ? `Pull back to about ${peakPct}% of the audience.`
              : `Target the top ${budget}% by predicted uplift: ${fmtInt(sel.k)} people.`}
          </h3>
          <p>
            {pastPeak ? (
              <>
                Beyond {peakPct}%, the people being added are estimated to convert <em>less</em> when they see the ad. At {budget}% the model expects {fmtInt(sel.estIncremental)} incremental conversions, fewer than the{' '}
                {fmtInt(ds.primary.cumTau[Math.round(sel.peakBudget * n)])} at the peak.
              </>
            ) : (
              <>
                The model expects about <b className="mono">{fmtInt(sel.estIncremental)}</b> incremental conversions on the test split ({fmtNum(per1k, 1)} per 1,000 targeted), {fmtNum(multiple, 1)}× what random targeting would deliver at the same budget.
                {reco.ranked.length ? ` ${Math.round(reco.topShare * 100)}% of the selected audience comes from three segments.` : ''}
              </>
            )}
          </p>
          <ul className="reco-list">
            {reco.ranked.slice(0, 3).map(({ s, share }) => (
              <li key={s.def.id}>
                <span className="is-pos">
                  <Icon name="target" size={14} />
                </span>
                <span>
                  <b>{s.def.name}</b> · {Math.round(share * 100)}% of the segment selected · estimated uplift {fmtPP(s.uplift)}
                </span>
              </li>
            ))}
            {reco.avoid.length ? (
              <li>
                <span className="is-neg">
                  <Icon name="ban" size={14} />
                </span>
                <span>
                  <b>Exclude {reco.avoid.map((s) => s.def.name).join(', ')}.</b> Ads are estimated to lower their conversion rate ({reco.avoid.map((s) => fmtPP(s.uplift)).join(', ')}).
                </span>
              </li>
            ) : null}
          </ul>
          {marginalSmall ? (
            <Callout tone="uncertain">
              Diminishing returns: the last people added gain under 0.5 pp each. Spending here buys little, and the estimate is within the seed-to-seed spread.
            </Callout>
          ) : null}
          {pastPeak ? <Callout tone="warning">Past the peak, every extra impression is estimated to cost conversions.</Callout> : null}
          <p style={{ marginTop: 14, marginBottom: 0 }}>
            <button type="button" className="btn" onClick={() => go('audiences')}>
              Review segments
              <Icon name="arrow-right" size={14} />
            </button>{' '}
            <button type="button" className="btn btn-ghost" onClick={() => go('experiments')}>
              See measured results
            </button>
          </p>
        </div>
      </section>

      <div style={{ marginTop: 20 }}>
        <Disclaimer>
          <strong>Estimates, not results.</strong> These numbers are offline predictions on a held-out split of a randomized experiment ({EXPERIMENT.id}, mock data). They show which people to prioritize, not guaranteed business outcomes. Confirm with a live holdout
          before scaling spend.
        </Disclaimer>
      </div>
    </div>
  );
}
