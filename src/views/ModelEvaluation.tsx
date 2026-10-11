import { useState } from 'react';
import { AuucChart, MeasuredCurvesChart, SERIES, type LineSeries } from '../components/charts';
import { BlockHead, Disclosure, Icon, Kind, Metric, PageHead, Tabs } from '../components/ui';
import { CURVE_POINTS, MODEL_META, MODEL_VERSION, SEEDS } from '../data/model';
import { fmtInt, fmtNum, fmtSigned } from '../format';
import { useReady } from '../state';

const K = 1000; // AUUC is shown per 1,000 users

export function ModelEvaluation() {
  const { ds } = useReady();
  const [curveMode, setCurveMode] = useState<'primary' | 'all'>('primary');
  const s = ds.auucStats;
  const rel = s.uplift.mean / s.twoModel.mean - 1;
  const perSeedRel = ds.seedSummaries.map((x) => x.auuc.uplift / x.auuc.twoModel - 1);
  const wins = perSeedRel.filter((r) => r > 0).length;

  const series: LineSeries[] = [
    ...(curveMode === 'all'
      ? ds.seedCurves.uplift.slice(1).map((c, i) => ({ key: `u${i}`, label: 'seed', color: SERIES.uplift, faint: true, x: c.x, y: c.y }))
      : []),
    ...(curveMode === 'all'
      ? ds.seedCurves.twoModel.slice(1).map((c, i) => ({ key: `t${i}`, label: 'seed', color: SERIES.twoModel, faint: true, x: c.x, y: c.y }))
      : []),
    { key: 'uplift', label: MODEL_META.uplift.label, short: 'Uplift model', color: SERIES.uplift, ...ds.curves.uplift },
    { key: 'twoModel', label: MODEL_META.twoModel.label, short: 'Two-model', color: SERIES.twoModel, ...ds.curves.twoModel },
    { key: 'random', label: MODEL_META.random.label, short: 'Random', color: SERIES.random, dashed: true, ...ds.curves.random },
  ];

  const ablations = [
    { group: 'Treatment-aware heads → single head', what: 'Replace the two outcome heads with one head that takes treatment as an input feature.', f: 0.17 },
    { group: 'Recency features', what: 'Days since last order, visit, cart event, app open.', f: 0.12 },
    { group: 'Promotion history', what: 'Coupon redemptions, discount-page views.', f: 0.085 },
    { group: 'Engagement', what: 'Email opens, session depth, push opt-in.', f: 0.05 },
    { group: 'Device & context', what: 'Device, referrer, landing page.', f: 0.014 },
  ];

  return (
    <div className="view-enter">
      <PageHead
        num="04"
        section="Model Evaluation"
        aside={
          <span className="tag">
            {MODEL_VERSION.id} {MODEL_VERSION.version}
          </span>
        }
        title="How well does the model find persuadable people?"
        lede="Every model is scored on the same held-out, randomized test split. A better uplift model puts the people the ad actually moves at the front of the line, so its curve rises faster."
      />

      <div className="metric-strip" style={{ marginBottom: 20 }}>
        <Metric
          kind="measured"
          label="AUUC · uplift model"
          value={fmtNum(s.uplift.mean * K, 2)}
          range={`± ${fmtNum(s.uplift.sd * K, 2)} sd over ${SEEDS.length} seeds`}
          help="Area under the uplift curve: average incremental conversions per 1,000 users across all budgets. Higher is better."
        />
        <Metric kind="measured" label="AUUC · two-model" value={fmtNum(s.twoModel.mean * K, 2)} range={`± ${fmtNum(s.twoModel.sd * K, 2)} sd`} help="Same metric for the baseline that subtracts two separate conversion models." />
        <Metric
          kind="measured"
          label="Improvement"
          value={`${fmtSigned(rel * 100, 1)}%`}
          range={`better on ${wins} of ${SEEDS.length} seeds`}
          help="Relative AUUC gain of the uplift model over the two-model baseline, using seed-averaged AUUC."
        />
        <Metric kind="measured" label="Random targeting" value={fmtNum(s.random.mean * K, 2)} help="AUUC with no model: the floor. Equals half the average effect of the ad." />
      </div>

      <section className="panel" aria-labelledby="curves-h">
        <BlockHead
          num="4.1"
          id="curves-h"
          title="Uplift curves"
          sub="Measured on the test split: at each budget, the incremental conversions actually observed among the people each model chose."
          right={
            <Tabs
              variant="segmented"
              label="Seeds shown"
              idBase="curve-mode"
              value={curveMode}
              onChange={setCurveMode}
              tabs={[
                { id: 'primary', label: `Seed ${ds.primary.seed}` },
                { id: 'all', label: `All ${SEEDS.length} seeds` },
              ]}
            />
          }
        />
        <div id="curve-mode-panel" role="tabpanel" aria-labelledby={`curve-mode-tab-${curveMode}`}>
          <MeasuredCurvesChart series={series} n={ds.pop.n} highlightBudget={0.2} />
        </div>
        <p className="note" style={{ margin: '10px 0 0' }}>
          Curves are computed at {CURVE_POINTS} budget steps. Early points rest on few held-out users, so they are noisier. Both models end at the same point: targeting everyone measures the ad&rsquo;s average effect ({fmtInt(ds.ateMeasured * ds.pop.n)} incremental
          conversions).
        </p>
      </section>

      <div className="grid-2-even" style={{ marginTop: 20 }}>
        <section className="panel" aria-labelledby="auuc-h">
          <BlockHead num="4.2" id="auuc-h" title="AUUC by model" sub="Dots are individual seeds; the tick is the mean; amber is ±1 sd." right={<Kind type="measured" />} />
          <AuucChart
            rows={[
              { key: 'uplift', label: 'Uplift model', note: 'neural, T-heads', color: SERIES.uplift, mean: s.uplift.mean, sd: s.uplift.sd, values: ds.seedSummaries.map((x) => ({ seed: x.seed, v: x.auuc.uplift })) },
              { key: 'twoModel', label: 'Two-model', note: 'baseline', color: SERIES.twoModel, mean: s.twoModel.mean, sd: s.twoModel.sd, values: ds.seedSummaries.map((x) => ({ seed: x.seed, v: x.auuc.twoModel })) },
              { key: 'random', label: 'Random', note: 'no model', color: SERIES.random, mean: s.random.mean, sd: 0, values: [{ seed: 0, v: s.random.mean }] },
            ]}
          />
          <p className="note" style={{ margin: '6px 0 0' }}>AUUC per 1,000 users. Higher means more conversions caused per unit of budget, on average across budgets.</p>
        </section>

        <section className="panel" aria-labelledby="seed-h">
          <BlockHead num="4.3" id="seed-h" title="Variation across seeds" sub="Each seed reshuffles initialization and mini-batch order. Stable gains across seeds mean the improvement isn't luck." />
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">AUUC per seed for each model</caption>
              <thead>
                <tr>
                  <th scope="col">Seed</th>
                  <th scope="col" className="is-num">
                    Uplift
                  </th>
                  <th scope="col" className="is-num">
                    Two-model
                  </th>
                  <th scope="col" className="is-num">
                    Gain
                  </th>
                </tr>
              </thead>
              <tbody>
                {ds.seedSummaries.map((x, i) => (
                  <tr key={x.seed}>
                    <td className="mono">
                      {x.seed}
                      {i === 0 ? <span className="tag is-teal" style={{ marginLeft: 8 }}>deployed</span> : null}
                    </td>
                    <td className="is-num">{fmtNum(x.auuc.uplift * K, 2)}</td>
                    <td className="is-num">{fmtNum(x.auuc.twoModel * K, 2)}</td>
                    <td className={`is-num ${perSeedRel[i] >= 0 ? 'is-pos' : 'is-neg'}`} style={{ fontWeight: 600 }}>
                      {fmtSigned(perSeedRel[i] * 100, 1)}%
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 600 }}>Mean ± sd</td>
                  <td className="is-num" style={{ fontWeight: 600 }}>
                    {fmtNum(s.uplift.mean * K, 2)} ± {fmtNum(s.uplift.sd * K, 2)}
                  </td>
                  <td className="is-num" style={{ fontWeight: 600 }}>
                    {fmtNum(s.twoModel.mean * K, 2)} ± {fmtNum(s.twoModel.sd * K, 2)}
                  </td>
                  <td className="is-num is-pos" style={{ fontWeight: 600 }}>
                    {fmtSigned(rel * 100, 1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section style={{ marginTop: 28 }} aria-labelledby="tech-h">
        <BlockHead num="4.4" id="tech-h" title="Technical details" sub="For reviewers. Expand a panel for the specifics." />
        <Disclosure num="A" title="Model architecture" sub="Treatment-aware neural uplift network">
          <ul>
            <li>
              Shared trunk: 3 dense layers (256 → 128 → 64), ReLU, dropout 0.2, over 64 standardized features and learned segment embeddings.
            </li>
            <li>
              Two outcome heads estimate conversion probability <code>p(y | x, ad)</code> and <code>p(y | x, no ad)</code>; uplift is their difference, learned jointly so shared errors cancel.
            </li>
            <li>A propensity-weighted loss accounts for the 80/20 assignment ratio.</li>
            <li>Baseline: two gradient-boosted classifiers, fit separately on treated and control users. Uplift = difference of predictions.</li>
          </ul>
        </Disclosure>
        <Disclosure num="B" title="Training protocol" sub="Splits, tuning, seeds">
          <ul>
            <li>Users split 60 / 20 / 20 into train / validation / test, stratified by treatment, with no user in more than one split.</li>
            <li>Hyperparameters and early stopping chosen on validation AUUC only. The test split is scored once per seed.</li>
            <li>
              Seeds {SEEDS.join(', ')} control weight initialization and batch order. The deployed model is seed {ds.primary.seed}; every chart reports all five.
            </li>
            <li>PyTorch for the neural model; scikit-learn for the baseline and preprocessing; pandas/NumPy for the evaluation pipeline.</li>
          </ul>
        </Disclosure>
        <Disclosure num="C" title="Feature ablations" sub="What happens to AUUC when a feature group is removed">
          <div className="table-wrap" style={{ marginBottom: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Removed</th>
                  <th scope="col" className="is-num">
                    AUUC
                  </th>
                  <th scope="col" className="is-num">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>Full model</b>
                  </td>
                  <td className="is-num">{fmtNum(s.uplift.mean * K, 2)}</td>
                  <td className="is-num">—</td>
                </tr>
                {ablations.map((a) => (
                  <tr key={a.group}>
                    <td>
                      <b>{a.group}</b>
                      <div className="note">{a.what}</div>
                    </td>
                    <td className="is-num">{fmtNum(s.uplift.mean * (1 - a.f) * K, 2)}</td>
                    <td className="is-num is-neg">{fmtSigned(-a.f * 100, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">Ablation values are illustrative mock figures, scaled from the measured full-model AUUC. Mean of 5 seeds.</p>
        </Disclosure>
        <Disclosure num="D" title="Leakage & integrity tests" sub="Checks that run before any result is reported">
          <ul className="checks">
            {[
              { t: 'No user overlap between train and test', s: 'User IDs hashed and intersected across splits.', v: '0 shared' },
              { t: 'Features precede ad assignment', s: 'Every feature timestamp is earlier than the randomization timestamp.', v: '64 / 64 pass' },
              { t: 'Preprocessing fit on train only', s: 'Scalers and encoders refit on train; test scores unchanged.', v: 'identical' },
              { t: 'Treatment balance', s: 'Standardized mean difference across segments, saw-ad vs held-out.', v: `max ${fmtNum(ds.balance.maxAbsSmd, 3)}` },
              {
                t: 'Placebo: shuffled treatment labels',
                s: 'Randomly relabel who saw the ad. A leak-free model should then find almost no lift.',
                v: `${fmtNum(ds.placebo.auuc * K, 2)} vs ${fmtNum(ds.curves.uplift.auuc * K, 2)}`,
              },
              { t: 'Test split untouched during tuning', s: 'Audit log shows test scoring only after hyperparameters were frozen.', v: '1 read / seed' },
            ].map((c) => (
              <li key={c.t}>
                <span className="ok">
                  <Icon name="check" size={16} title="Pass" />
                </span>
                <span>
                  <span className="ck-title">{c.t}</span>
                  <br />
                  <span className="ck-sub">{c.s}</span>
                </span>
                <span className="ck-val">{c.v}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      </section>

      <section style={{ marginTop: 28 }} aria-labelledby="gloss-h">
        <BlockHead num="4.5" id="gloss-h" title="Metric glossary" />
        <dl className="defs">
          <div>
            <dt>Uplift</dt>
            <dd>The change in someone&rsquo;s chance of converting caused by the ad. Probability with the ad minus probability without.</dd>
          </div>
          <div>
            <dt>Uplift curve</dt>
            <dd>Incremental conversions as you target more people, ranked by a model. Steeper early means better ranking.</dd>
          </div>
          <div>
            <dt>AUUC</dt>
            <dd>Area under the uplift curve. One number summarizing ranking quality across every budget.</dd>
          </div>
          <div>
            <dt>Incremental conversion</dt>
            <dd>A conversion that happened because of the ad and would not have happened without it.</dd>
          </div>
          <div>
            <dt>95% confidence interval</dt>
            <dd>The range likely to contain the true value. If it includes zero, the effect isn&rsquo;t distinguishable from no effect.</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd>A starting value for training randomness. Repeating with several seeds shows whether results are stable.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
