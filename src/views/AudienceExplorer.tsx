import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { ForestPlot } from '../components/charts';
import { MiniVersus, PairedBars } from '../components/compare';
import { Drawer } from '../components/Drawer';
import { BudgetControl, EmptyState, Icon, Kind, PageHead, RecBadge, UncertainBadge, recLabel } from '../components/ui';
import type { Recommendation, SegmentStats, Selection } from '../data/model';
import { fmtInt, fmtNum, fmtPP, fmtPct } from '../format';
import { useReady } from '../state';

type SortKey = 'name' | 'n' | 'pNoAd' | 'pAd' | 'uplift' | 'share' | 'rec';
const REC_ORDER: Record<Recommendation, number> = { Target: 0, Partial: 1, Hold: 2, Avoid: 3 };
const FILTERS: (Recommendation | 'All')[] = ['All', 'Target', 'Partial', 'Hold', 'Avoid'];

function isUncertain(s: SegmentStats): boolean {
  return s.measured.ci[0] < 0 && s.measured.ci[1] > 0;
}

export function AudienceExplorer({ param, go }: { param?: string; go: (path: string) => void }) {
  const { ds, selection: sel, budget, setBudget } = useReady();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Recommendation | 'All'>('All');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'uplift', dir: -1 });

  const maxP = Math.max(...ds.segments.map((s) => Math.max(s.pAd, s.pNoAd)));
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: ds.segments.length, Target: 0, Partial: 0, Hold: 0, Avoid: 0 };
    sel.segRec.forEach((r) => c[r]++);
    return c;
  }, [ds, sel]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const val = (s: SegmentStats): number | string => {
      switch (sort.key) {
        case 'name':
          return s.def.code;
        case 'n':
          return s.n;
        case 'pNoAd':
          return s.pNoAd;
        case 'pAd':
          return s.pAd;
        case 'uplift':
          return s.uplift;
        case 'share':
          return sel.segShare[s.index];
        case 'rec':
          return REC_ORDER[sel.segRec[s.index]] * 10 - s.uplift;
      }
    };
    return ds.segments
      .filter((s) => filter === 'All' || sel.segRec[s.index] === filter)
      .filter((s) => !q || `${s.def.code} ${s.def.name} ${s.def.description} ${s.def.archetype}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
  }, [ds, sel, query, filter, sort]);

  const selected = ds.segments.find((s) => s.def.id === param) ?? null;
  const close = useCallback(() => go('audiences'), [go]);
  const open = (id: string) => go(`audiences/${id}`);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' || key === 'rec' ? 1 : -1 }));

  const SortTh = ({ k, label, num, cls }: { k: SortKey; label: string; num?: boolean; cls?: string }) => (
    <th scope="col" className={[num ? 'is-num' : '', cls ?? ''].join(' ').trim() || undefined} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort-btn" onClick={() => toggleSort(k)}>
        {label}
        <span className="sort-icon">
          <Icon name={sort.key === k ? (sort.dir === 1 ? 'arrow-up' : 'arrow-down') : 'sort'} size={11} />
        </span>
      </button>
    </th>
  );

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(id);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const tr = e.currentTarget;
      const next = (e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling) as HTMLElement | null;
      next?.focus();
    }
  };

  const clearAll = () => {
    setQuery('');
    setFilter('All');
  };

  return (
    <div className="view-enter">
      <PageHead
        num="02"
        section="Audience Explorer"
        title="Who does the ad actually move?"
        lede="Every segment, with its predicted conversion probability with and without the ad. Wide gaps mean persuadable people; coral marks segments where ads backfire."
      />

      <div style={{ marginBottom: 18 }}>
        <BudgetControl compact value={budget} onChange={setBudget} help="Recommendations below update with the budget" />
      </div>

      <div className="toolbar">
        <div className="field">
          <label className="field-label" htmlFor="seg-search">
            Search segments
          </label>
          <div className="search">
            <Icon name="search" size={14} />
            <input id="seg-search" type="search" placeholder="e.g. lapsed, S03, persuadable" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {query ? (
              <button type="button" className="clear" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="x" size={12} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="field">
          <span className="field-label" id="rec-filter-label">
            Recommendation at {budget}%
          </span>
          <div className="chips" role="group" aria-labelledby="rec-filter-label">
            {FILTERS.map((f) => (
              <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'All' ? 'All' : recLabel(f)}
                <span className="chip-count">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <section aria-labelledby="seg-table-h">
        <h2 id="seg-table-h" className="sr-only">
          Segments
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            title="No segments match"
            message={
              <>
                Nothing matches {query ? <b>“{query}”</b> : 'this filter'}
                {filter !== 'All' ? <> with recommendation <b>{recLabel(filter)}</b></> : null}. Try a broader term, or change the budget: recommendations depend on it.
              </>
            }
            action={
              <button type="button" className="btn" onClick={clearAll}>
                Clear search and filters
              </button>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Audience segments with predicted conversion probability without and with the ad. Select a row for details.</caption>
                <thead>
                  <tr>
                    <SortTh k="name" label="Segment" />
                    <SortTh k="n" label="Users" num cls="hide-sm" />
                    <SortTh k="pNoAd" label="Without ad" num />
                    <SortTh k="pAd" label="With ad" num />
                    <th scope="col">
                      <span className="sr-only">Comparison bars</span>
                      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <i className="tooltip-key" style={{ background: 'var(--gray-series)' }} />
                          no ad
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <i className="tooltip-key" style={{ background: 'var(--teal-series)' }} />
                          ad
                        </span>
                      </span>
                    </th>
                    <SortTh k="uplift" label="Est. uplift" num />
                    <SortTh k="share" label="In audience" num cls="hide-sm" />
                    <SortTh k="rec" label="Recommendation" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const rec = sel.segRec[s.index];
                    return (
                      <tr
                        key={s.def.id}
                        className={`row-btn${selected?.def.id === s.def.id ? ' is-selected' : ''}`}
                        tabIndex={0}
                        onClick={() => open(s.def.id)}
                        onKeyDown={(e) => onRowKey(e, s.def.id)}
                        aria-label={`${s.def.name}: ${fmtPct(s.pNoAd)} without ad, ${fmtPct(s.pAd)} with ad, uplift ${fmtPP(s.uplift)}, ${recLabel(rec)}. Open details.`}
                      >
                        <td>
                          <div className="seg-cell">
                            <span className="seg-code">
                              {s.def.code} · {s.def.archetype}
                            </span>
                            <span className="seg-name">{s.def.name}</span>
                          </div>
                        </td>
                        <td className="is-num hide-sm">{fmtInt(s.n)}</td>
                        <td className="is-num">{fmtPct(s.pNoAd)}</td>
                        <td className="is-num">{fmtPct(s.pAd)}</td>
                        <td>
                          <PairedBars pNoAd={s.pNoAd} pAd={s.pAd} max={maxP} />
                        </td>
                        <td className="is-num">
                          <span className="uplift-cell">
                            {isUncertain(s) ? (
                              <span title="Measured 95% interval includes zero" style={{ color: 'var(--amber)', display: 'inline-flex' }}>
                                <Icon name="alert" size={12} title="Uncertain: measured interval includes zero" />
                              </span>
                            ) : null}
                            <span className={s.uplift < 0 ? 'is-neg' : 'is-pos'} style={{ fontWeight: 600 }}>
                              {fmtPP(s.uplift)}
                            </span>
                          </span>
                        </td>
                        <td className="is-num hide-sm">
                          <span className="share-meter" aria-hidden="true">
                            <span style={{ width: `${sel.segShare[s.index] * 100}%` }} />
                          </span>
                          {Math.round(sel.segShare[s.index] * 100)}%
                        </td>
                        <td>
                          <RecBadge rec={rec} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span>
                Showing {rows.length} of {ds.segments.length} segments · {fmtInt(ds.pop.n)} users · probabilities are model estimates (seed {ds.primary.seed})
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--amber)', display: 'inline-flex' }}>
                  <Icon name="alert" size={12} />
                </span>
                measured effect not yet distinguishable from zero
              </span>
            </div>
          </>
        )}
      </section>

      <SegmentDrawer seg={selected} sel={sel} seed={ds.primary.seed} budget={budget} onClose={close} onNav={open} order={rows.length ? rows : ds.segments} />
    </div>
  );
}

function explain(s: SegmentStats): string {
  const p0 = fmtPct(s.pNoAd);
  const p1 = fmtPct(s.pAd);
  const per1k = fmtNum(Math.abs(s.uplift) * 1000, 0);
  switch (s.def.archetype) {
    case 'Persuadable':
      return `People here are fairly unlikely to convert on their own (${p0}), but the ad moves a real share of them, to ${p1}. That's about ${per1k} extra conversions for every 1,000 people reached, so ad spend works hard here.`;
    case 'Sure thing':
      return s.uplift < 0
        ? `These people already convert at a high rate (${p0}) and the ad is estimated to nudge that down slightly, to ${p1}. Advertising to them mostly pays for conversions that would happen anyway.`
        : `These people already convert at a high rate (${p0}) whether or not they see the ad. The ad adds only about ${per1k} per 1,000, so showing it mostly pays for conversions that would happen anyway.`;
    case 'Lost cause':
      return `Conversion is low with or without the ad (${p0} → ${p1}). The ad adds roughly ${per1k} conversions per 1,000 people, so budget usually does more elsewhere.`;
    case 'Do-not-disturb':
      return `The ad is estimated to lower conversion here, from ${p0} to ${p1}: about ${per1k} fewer conversions per 1,000 people. Recent buyers and people dealing with support may find more ads intrusive. Suppress this segment.`;
  }
}

function measuredSentence(s: SegmentStats): string {
  const { diff, ci } = s.measured;
  const crosses = ci[0] < 0 && ci[1] > 0;
  const agrees = Math.sign(diff) === Math.sign(s.uplift);
  if (crosses)
    return `The randomized test split can't confirm this yet. The measured difference (${fmtPP(diff)}) has a 95% interval of ${fmtPP(ci[0])} to ${fmtPP(ci[1])}, which includes zero. Treat this estimate with caution.`;
  if (agrees) return `The randomized test split agrees: people who saw the ad converted ${fmtPP(diff)} ${diff >= 0 ? 'more' : 'less'} than those who didn't (95% interval ${fmtPP(ci[0])} to ${fmtPP(ci[1])}).`;
  return `The randomized test split points the other way (${fmtPP(diff)}, 95% interval ${fmtPP(ci[0])} to ${fmtPP(ci[1])}). Review this segment before acting on it.`;
}

function SegmentDrawer({ seg, sel, seed, budget, onClose, onNav, order }: { seg: SegmentStats | null; sel: Selection; seed: number; budget: number; onClose: () => void; onNav: (id: string) => void; order: SegmentStats[] }) {
  if (!seg) return null;
  const idx = order.findIndex((s) => s.def.id === seg.def.id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  const rec = sel.segRec[seg.index];
  const share = sel.segShare[seg.index];
  const uncertain = isUncertain(seg);
  const titleId = `drawer-title-${seg.def.id}`;
  return (
    <Drawer
      open
      onClose={onClose}
      labelledBy={titleId}
      header={
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tag">{seg.def.code}</span>
            <span className="tag">{seg.def.archetype}</span>
            <span className="drawer-nav">
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} disabled={!prev} onClick={() => prev && onNav(prev.def.id)} aria-label={prev ? `Previous segment: ${prev.def.name}` : 'No previous segment'}>
                <Icon name="prev" size={12} />
              </button>
              <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} disabled={!next} onClick={() => next && onNav(next.def.id)} aria-label={next ? `Next segment: ${next.def.name}` : 'No next segment'}>
                <Icon name="next" size={12} />
              </button>
            </span>
          </div>
          <h2 className="drawer-title" id={titleId}>
            {seg.def.name}
          </h2>
          <p className="note" style={{ margin: 0 }}>
            {seg.def.description} · {fmtInt(seg.n)} users in test split
          </p>
        </>
      }
    >
      <section className="drawer-section">
        <h3>
          Recommendation at {budget}% budget
        </h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <RecBadge rec={rec} />
          {uncertain ? <UncertainBadge /> : null}
          <span className="note">
            {share > 0 && share < 0.005 ? '<1' : Math.round(share * 100)}% of this segment ({fmtInt(share * seg.n)} people) is in your selected audience.
          </span>
        </div>
      </section>

      <section className="drawer-section">
        <h3>
          Conversion with vs. without advertising <Kind type="estimate" />
        </h3>
        <MiniVersus pNoAd={seg.pNoAd} pAd={seg.pAd} />
      </section>

      <section className="drawer-section">
        <h3>What this means</h3>
        <p className="plain">{explain(seg)}</p>
        <p className="plain" style={{ marginTop: 10 }}>
          {measuredSentence(seg)}
        </p>
      </section>

      <section className="drawer-section">
        <h3>Uncertainty</h3>
        <ForestPlot
          compact
          rows={[
            {
              key: 'seg',
              label: seg.def.name,
              color: 'var(--ink)',
              measured: { v: seg.measured.diff * 100, lo: seg.measured.ci[0] * 100, hi: seg.measured.ci[1] * 100 },
              estimate: { v: seg.uplift * 100, lo: seg.seedRange[0] * 100, hi: seg.seedRange[1] * 100 },
            },
          ]}
          unit="pp"
          format={(v) => fmtNum(v, 1)}
          axisLabel="Uplift, percentage points"
        />
        <div className="split-label" style={{ marginTop: 4 }}>
          <Kind type="estimate">Model estimate · amber = seed range</Kind>
          <Kind type="measured">Measured · bar = 95% CI</Kind>
        </div>
        <dl className="kv">
          <dt>Model estimate (seed {seed})</dt>
          <dd>{fmtPP(seg.uplift, 2)}</dd>
          <dt>Range across 5 seeds</dt>
          <dd>
            {fmtPP(seg.seedRange[0], 2)} to {fmtPP(seg.seedRange[1], 2)}
          </dd>
          <dt>Measured difference (ad − no ad)</dt>
          <dd>{fmtPP(seg.measured.diff, 2)}</dd>
          <dt>95% CI (normal approx.)</dt>
          <dd>
            {fmtPP(seg.measured.ci[0], 2)} to {fmtPP(seg.measured.ci[1], 2)}
          </dd>
          <dt>Saw ad / held out</dt>
          <dd>
            {fmtInt(seg.measured.nt)} / {fmtInt(seg.measured.nc)}
          </dd>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>Strongest model signals</h3>
        <ul className="signals">
          {seg.def.signals.map((sig) => (
            <li key={sig} className="tag">
              {sig}
            </li>
          ))}
        </ul>
        <p className="note" style={{ marginTop: 8 }}>
          Features with the largest attribution for this segment&rsquo;s uplift scores. Illustrative; mock data.
        </p>
      </section>
    </Drawer>
  );
}
