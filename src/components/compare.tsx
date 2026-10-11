import type { ReactNode } from 'react';
import { fmtNum, fmtPct, fmtPP } from '../format';
import { Icon } from './ui';

/** The signature LiftLab comparison: predicted conversion probability without vs. with the ad. */
export function Versus({ pNoAd, pAd, caption, footnote }: { pNoAd: number; pAd: number; caption: ReactNode; footnote?: ReactNode }) {
  const delta = pAd - pNoAd;
  const neg = delta < 0;
  const scale = Math.max(pNoAd, pAd) * 1.18 || 1;
  const ratio = pNoAd > 0 ? pAd / pNoAd : NaN;
  const per1k = (p: number) => fmtNum(p * 1000, p * 1000 < 10 ? 1 : 0);
  return (
    <figure className="versus" style={{ margin: 0 }} aria-label={`Predicted conversion probability without ad ${fmtPct(pNoAd)}, with ad ${fmtPct(pAd)}, difference ${fmtPP(delta)}`}>
      <div className="versus-cell is-without">
        <p className="versus-label">
          <span className="versus-key" style={{ background: 'var(--gray-series)' }} />
          Without advertising
        </p>
        <div className="versus-value">{fmtPct(pNoAd)}</div>
        <div className="versus-sub">would convert anyway</div>
      </div>
      <div className="versus-arrow" aria-hidden="true">
        <Icon name="arrow-right" size={20} />
      </div>
      <div className="versus-cell is-with">
        <p className="versus-label">
          <span className="versus-key" style={{ background: 'var(--teal)' }} />
          With advertising
        </p>
        <div className="versus-value">{fmtPct(pAd)}</div>
        <div className="versus-sub">predicted to convert</div>
      </div>
      <div className={`versus-cell versus-delta${neg ? ' is-negative' : ''}`}>
        <p className="versus-label">{neg ? 'Lost to advertising' : 'Caused by advertising'}</p>
        <div className="versus-value">{fmtPP(delta)}</div>
        <div className="versus-sub">{Number.isFinite(ratio) ? `${fmtNum(ratio, 2)}× the no-ad rate` : 'estimated uplift'}</div>
      </div>
      <div className="versus-bars" aria-hidden="true">
        <div className="vbar">
          <span className="vbar-label">Without ad</span>
          <span className="vbar-track">
            <span className="vbar-fill" style={{ width: `${(pNoAd / scale) * 100}%`, background: 'var(--gray-series)' }} />
          </span>
          <span className="vbar-value">{fmtPct(pNoAd)}</span>
        </div>
        <div className="vbar">
          <span className="vbar-label">With ad</span>
          <span className="vbar-track">
            <span className="vbar-fill" style={{ width: `${(Math.min(pNoAd, pAd) / scale) * 100}%`, background: neg ? 'var(--teal)' : 'var(--teal)' }} />
            <span className={`vbar-gain${neg ? ' is-loss' : ''}`} style={{ left: `${(Math.min(pNoAd, pAd) / scale) * 100}%`, width: `${(Math.abs(delta) / scale) * 100}%` }} />
          </span>
          <span className="vbar-value">{fmtPct(pAd)}</span>
        </div>
      </div>
      <figcaption className="versus-plain">
        {caption} out of every 1,000 people, about <b>{per1k(pNoAd)}</b> would convert without the ad and <b>{per1k(pAd)}</b> with it, so the ad is estimated to {neg ? 'cost' : 'cause'} <b>{per1k(Math.abs(delta))}</b> conversions per 1,000.
        {footnote ? <span className="note" style={{ display: 'block', marginTop: 6 }}>{footnote}</span> : null}
      </figcaption>
    </figure>
  );
}

export function MiniVersus({ pNoAd, pAd }: { pNoAd: number; pAd: number }) {
  const delta = pAd - pNoAd;
  const neg = delta < 0;
  return (
    <div className="mini-versus" role="group" aria-label="Predicted conversion with and without advertising">
      <div>
        <p className="versus-label">
          <span className="versus-key" style={{ background: 'var(--gray-series)' }} />
          Without ad
        </p>
        <div className="v">{fmtPct(pNoAd)}</div>
      </div>
      <div className="is-with">
        <p className="versus-label">
          <span className="versus-key" style={{ background: 'var(--teal)' }} />
          With ad
        </p>
        <div className="v">{fmtPct(pAd)}</div>
      </div>
      <div className={`is-delta${neg ? ' is-negative' : ''}`}>
        <p className="versus-label">{neg ? 'Lost' : 'Uplift'}</p>
        <div className="v">{fmtPP(delta)}</div>
      </div>
    </div>
  );
}

/** Compact paired bars for scanning the probability difference in a table row. */
export function PairedBars({ pNoAd, pAd, max }: { pNoAd: number; pAd: number; max: number }) {
  const w = (p: number) => `${Math.max(0, Math.min(1, p / max)) * 100}%`;
  return (
    <div className="pair" aria-hidden="true">
      <div className="pair-row">
        <span className="is-without" style={{ width: w(pNoAd) }} />
      </div>
      <div className="pair-row">
        <span className={`is-with${pAd < pNoAd ? ' is-loss' : ''}`} style={{ width: w(pAd) }} />
      </div>
    </div>
  );
}
