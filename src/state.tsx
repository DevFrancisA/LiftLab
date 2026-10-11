import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildDataset, select, type Dataset, type Selection } from './data/model';

// ───────────────────────────── routing ─────────────────────────────

export type ViewId = 'overview' | 'audiences' | 'experiments' | 'evaluation';

export const VIEWS: { id: ViewId; num: string; label: string }[] = [
  { id: 'overview', num: '01', label: 'Overview' },
  { id: 'audiences', num: '02', label: 'Audience Explorer' },
  { id: 'experiments', num: '03', label: 'Experiments' },
  { id: 'evaluation', num: '04', label: 'Model Evaluation' },
];

export interface Route {
  view: ViewId;
  param?: string;
}

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const view = VIEWS.find((v) => v.id === parts[0])?.id ?? 'overview';
  return { view, param: parts[1] };
}

export function useHashRoute(): [Route, (path: string) => void] {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((path: string) => {
    window.location.hash = `#/${path}`;
  }, []);
  return [route, navigate];
}

// ───────────────────────────── data + budget ─────────────────────────────

/** `?demo=error` or `?demo=slow` in the URL exercises the error and loading states. */
function demoMode(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('demo');
  } catch {
    return null;
  }
}

const BUDGET_KEY = 'liftlab.budget';

function readBudget(): number {
  try {
    const v = Number(window.localStorage.getItem(BUDGET_KEY));
    if (Number.isFinite(v) && v >= 1 && v <= 100) return Math.round(v);
  } catch {
    /* storage unavailable */
  }
  return 20;
}

type Status = 'loading' | 'ready' | 'error';

interface AppData {
  status: Status;
  error: string | null;
  ds: Dataset | null;
  retry: () => void;
  budget: number;
  setBudget: (pct: number) => void;
  selection: Selection | null;
}

const Ctx = createContext<AppData | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [ds, setDs] = useState<Dataset | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [budget, setBudgetRaw] = useState(readBudget);

  useEffect(() => {
    setStatus('loading');
    setError(null);
    const demo = demoMode();
    const delay = demo === 'slow' ? 2500 : 60;
    const t = window.setTimeout(() => {
      try {
        if (demo === 'error' && attempt === 0) throw new Error('Could not load the evaluation snapshot for EXP-0412 (simulated failure).');
        setDs(buildDataset());
        setStatus('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [attempt]);

  const setBudget = useCallback((pct: number) => {
    const v = Math.max(1, Math.min(100, Math.round(pct)));
    setBudgetRaw(v);
    try {
      window.localStorage.setItem(BUDGET_KEY, String(v));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const selection = useMemo(() => (ds ? select(ds, budget / 100) : null), [ds, budget]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const value = useMemo(
    () => ({ status, error, ds, retry, budget, setBudget, selection }),
    [status, error, ds, retry, budget, setBudget, selection],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** For views that render only once data is ready. */
export function useReady(): { ds: Dataset; selection: Selection; budget: number; setBudget: (pct: number) => void } {
  const { ds, selection, budget, setBudget } = useApp();
  if (!ds || !selection) throw new Error('Data not ready');
  return { ds, selection, budget, setBudget };
}
