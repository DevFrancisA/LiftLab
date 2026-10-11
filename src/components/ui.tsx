import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Recommendation } from '../data/model';

// ───────────────────────────── icons ─────────────────────────────

type IconName = 'search' | 'x' | 'chevron' | 'arrow-right' | 'arrow-up' | 'arrow-down' | 'sort' | 'check' | 'alert' | 'info' | 'minus' | 'target' | 'pause' | 'ban' | 'half' | 'prev' | 'next' | 'refresh';

export function Icon({ name, size = 14, title }: { name: IconName; size?: number; title?: string }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, ReactNode> = {
    search: (
      <>
        <circle cx="7" cy="7" r="4.5" {...p} />
        <path d="M10.5 10.5 14 14" {...p} />
      </>
    ),
    x: <path d="M4 4l8 8M12 4l-8 8" {...p} />,
    chevron: <path d="M4 6l4 4 4-4" {...p} />,
    'arrow-right': <path d="M3 8h10M9 4l4 4-4 4" {...p} />,
    'arrow-up': <path d="M8 13V3M4 7l4-4 4 4" {...p} />,
    'arrow-down': <path d="M8 3v10M4 9l4 4 4-4" {...p} />,
    sort: <path d="M5 6l3-3 3 3M5 10l3 3 3-3" {...p} />,
    check: <path d="M3 8.5l3 3 7-7" {...p} />,
    alert: (
      <>
        <path d="M8 2 14.5 13.5h-13z" {...p} />
        <path d="M8 6.5v3M8 11.5v.01" {...p} />
      </>
    ),
    info: (
      <>
        <circle cx="8" cy="8" r="6" {...p} />
        <path d="M8 7.5v3.5M8 5v.01" {...p} />
      </>
    ),
    minus: <path d="M3.5 8h9" {...p} />,
    target: (
      <>
        <circle cx="8" cy="8" r="5.5" {...p} />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
      </>
    ),
    half: (
      <>
        <circle cx="8" cy="8" r="5.5" {...p} />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </>
    ),
    pause: <circle cx="8" cy="8" r="5.5" {...p} strokeDasharray="2 2" />,
    ban: (
      <>
        <circle cx="8" cy="8" r="5.5" {...p} />
        <path d="M4.2 11.8l7.6-7.6" {...p} />
      </>
    ),
    prev: <path d="M10 3 5 8l5 5" {...p} />,
    next: <path d="M6 3l5 5-5 5" {...p} />,
    refresh: (
      <>
        <path d="M13 8a5 5 0 1 1-1.5-3.6" {...p} />
        <path d="M13 2.5v3h-3" {...p} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}

// ───────────────────────────── labels ─────────────────────────────

const REC_META: Record<Recommendation, { cls: string; icon: IconName; text: string }> = {
  Target: { cls: 'badge-target', icon: 'target', text: 'Target' },
  Partial: { cls: 'badge-partial', icon: 'half', text: 'Target top users' },
  Hold: { cls: 'badge-hold', icon: 'pause', text: 'Hold' },
  Avoid: { cls: 'badge-avoid', icon: 'ban', text: 'Do not target' },
};

export function RecBadge({ rec }: { rec: Recommendation }) {
  const m = REC_META[rec];
  return (
    <span className={`badge ${m.cls}`}>
      <Icon name={m.icon} size={12} />
      {m.text}
    </span>
  );
}

export function recLabel(rec: Recommendation): string {
  return REC_META[rec].text;
}

export function UncertainBadge({ label = 'Uncertain' }: { label?: string }) {
  return (
    <span className="badge badge-uncertain" title="The 95% interval for the measured effect includes zero">
      <Icon name="alert" size={11} />
      {label}
    </span>
  );
}

export function Kind({ type, children }: { type: 'estimate' | 'measured'; children?: ReactNode }) {
  return <span className={`kind kind-${type}`}>{children ?? (type === 'estimate' ? 'Model estimate' : 'Measured')}</span>;
}

export function PageHead({ num, section, title, lede, aside }: { num: string; section: string; title: ReactNode; lede?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="page-head">
      <p className="eyebrow">
        <span className="eyebrow-num">{num}</span>
        <span className="eyebrow-rule" aria-hidden="true" />
        <span>{section}</span>
        {aside}
      </p>
      <h1 className="page-title">{title}</h1>
      {lede ? <p className="page-lede">{lede}</p> : null}
    </header>
  );
}

export function BlockHead({ num, title, sub, right, id }: { num?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <div className="block-head">
      <div>
        <h2 className="block-title" id={id}>
          {num ? <span className="block-num">{num}</span> : null}
          {title}
        </h2>
        {sub ? <p className="block-sub">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Metric({ label, value, unit, range, help, kind }: { label: ReactNode; value: ReactNode; unit?: ReactNode; range?: ReactNode; help?: ReactNode; kind?: 'estimate' | 'measured' }) {
  return (
    <div className="metric">
      <p className="metric-label">
        {label}
        {kind === 'estimate' ? <span className="sr-only">(model estimate)</span> : null}
      </p>
      <div className="metric-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {range ? <div className="metric-range">{range}</div> : null}
      {help ? <p className="metric-help">{help}</p> : null}
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <div className="disclaimer" role="note">
      <Icon name="info" size={14} />
      <div>{children}</div>
    </div>
  );
}

export function Callout({ tone, children }: { tone: 'warning' | 'uncertain' | 'info'; children: ReactNode }) {
  return (
    <div className={`callout is-${tone}`} role={tone === 'warning' ? 'alert' : 'note'}>
      <Icon name={tone === 'info' ? 'info' : 'alert'} size={14} />
      <div>{children}</div>
    </div>
  );
}

// ───────────────────────────── budget control ─────────────────────────────

export function BudgetControl({ value, onChange, compact, help }: { value: number; onChange: (v: number) => void; compact?: boolean; help?: ReactNode }) {
  const id = useId();
  const ticks = [1, 25, 50, 75, 100];
  return (
    <div className={`budget${compact ? ' is-compact' : ''}`}>
      <div className="budget-label">
        <label htmlFor={id}>Targeting budget</label>
        <span>{help ?? 'Share of the audience that sees the ad'}</span>
      </div>
      <div className="budget-track">
        <input
          id={id}
          className="range"
          type="range"
          min={1}
          max={100}
          step={1}
          value={value}
          aria-valuetext={`${value}% of audience targeted`}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ ['--fill' as string]: `${((value - 1) / 99) * 100}%` }}
        />
        <div className="budget-ticks" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ left: `${((t - 1) / 99) * 100}%` }}>
              {t}%
            </span>
          ))}
        </div>
      </div>
      <output className="budget-readout" htmlFor={id} aria-live="off">
        {value}%
      </output>
    </div>
  );
}

// ───────────────────────────── tabs & segmented ─────────────────────────────

export function Tabs<T extends string>({ tabs, value, onChange, label, variant = 'tabs', idBase }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; variant?: 'tabs' | 'segmented'; idBase?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div className={variant} role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          id={idBase ? `${idBase}-tab-${t.id}` : undefined}
          aria-controls={idBase ? `${idBase}-panel` : undefined}
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────── disclosure ─────────────────────────────

export function Disclosure({ num, title, sub, children, defaultOpen = false }: { num?: string; title: ReactNode; sub?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="disclosure">
      <h3 style={{ margin: 0 }}>
        <button type="button" className="disclosure-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          <span className="block-num">{num}</span>
          <span>
            <span className="t">{title}</span>
            {sub ? <span className="s">{sub}</span> : null}
          </span>
          <span className="disclosure-chev">
            <Icon name="chevron" size={16} />
          </span>
        </button>
      </h3>
      {open ? (
        <div className="disclosure-body" id={id}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

// ───────────────────────────── states ─────────────────────────────

export function LoadingState({ label = 'Scoring 100,000 held-out users across 5 seeds…' }: { label?: string }) {
  return (
    <div className="loading-grid" aria-busy="true" aria-live="polite">
      <div className="loading-status">
        <span className="pulse-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {label}
      </div>
      <div className="skeleton" style={{ height: 14, width: 180 }} />
      <div className="skeleton" style={{ height: 52, width: 'min(640px, 100%)' }} />
      <div className="skeleton" style={{ height: 18, width: 'min(520px, 90%)' }} />
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="skeleton" style={{ height: 340 }} />
        <div className="skeleton" style={{ height: 340 }} />
      </div>
      <div className="skeleton" style={{ height: 160 }} />
    </div>
  );
}

export function InlineLoading({ label, height = 220 }: { label: string; height?: number }) {
  return (
    <div className="loading-grid" aria-busy="true" aria-live="polite">
      <div className="loading-status">
        <span className="pulse-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {label}
      </div>
      <div className="skeleton" style={{ height }} />
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="state is-error" role="alert">
      <span className="state-code">Error · nothing was changed</span>
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <Icon name="refresh" size={14} />
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: ReactNode; action?: ReactNode }) {
  return (
    <div className="state" role="status">
      <span className="state-code">No results</span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}
