import { Component, useEffect, useRef, type ReactNode } from 'react';
import { ErrorState, LoadingState } from './components/ui';
import { EXPERIMENT, MODEL_VERSION, N_TEST } from './data/model';
import { fmtInt } from './format';
import { AppProvider, VIEWS, useApp, useHashRoute, type Route } from './state';
import { AudienceExplorer } from './views/AudienceExplorer';
import { Experiments } from './views/Experiments';
import { ModelEvaluation } from './views/ModelEvaluation';
import { Overview } from './views/Overview';

class ViewBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return <ErrorState title="This view hit a problem" message={`${this.state.error.message}. Your budget and other views are unaffected.`} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

function Sidebar({ route }: { route: Route }) {
  return (
    <nav className="sidebar" aria-label="Primary">
      <a className="brand" href="#/overview">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <span>
          <span className="brand-name">LiftLab</span>
          <span className="brand-tag">Uplift targeting</span>
        </span>
      </a>
      <ul className="nav">
        {VIEWS.map((v) => (
          <li key={v.id}>
            <a href={`#/${v.id}`} aria-current={route.view === v.id ? 'page' : undefined}>
              <span className="nav-num">{v.num}</span>
              <span>{v.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="sidebar-foot">
        <strong>Mock data</strong>
        All figures come from a simulated randomized experiment. Offline estimates, not business results.
      </div>
    </nav>
  );
}

function TopBar() {
  return (
    <div className="topbar" role="region" aria-label="Current context">
      <span className="topbar-item">
        <span className="topbar-key">Experiment</span>
        <span className="tag">{EXPERIMENT.id}</span>
        <span>{EXPERIMENT.name}</span>
      </span>
      <span className="topbar-sep" aria-hidden="true" />
      <span className="topbar-item">
        <span className="topbar-key">Split</span>
        <span className="mono">test · n={fmtInt(N_TEST)} · 80/20</span>
      </span>
      <span className="topbar-sep" aria-hidden="true" />
      <span className="topbar-item">
        <span className="topbar-key">Model</span>
        <span className="mono">
          {MODEL_VERSION.id} {MODEL_VERSION.version}
        </span>
        <span className="tag">seed {MODEL_VERSION.seed}</span>
      </span>
      <span className="topbar-spacer" />
      <span className="tag is-mock">
        <span className="tag-dot" aria-hidden="true" />
        Mock data
      </span>
    </div>
  );
}

function Content({ route, go }: { route: Route; go: (p: string) => void }) {
  const { status, error, retry } = useApp();
  if (status === 'loading') return <LoadingState />;
  if (status === 'error')
    return <ErrorState title="Couldn't load the experiment" message={`${error ?? 'Unknown error.'} Check your connection and try again.`} onRetry={retry} />;
  switch (route.view) {
    case 'overview':
      return <Overview go={go} />;
    case 'audiences':
      return <AudienceExplorer param={route.param} go={go} />;
    case 'experiments':
      return <Experiments />;
    case 'evaluation':
      return <ModelEvaluation />;
  }
}

function Shell() {
  const [route, go] = useHashRoute();
  const main = useRef<HTMLElement>(null);
  const label = VIEWS.find((v) => v.id === route.view)?.label ?? 'Overview';

  useEffect(() => {
    document.title = `${label} · LiftLab`;
  }, [label]);

  // Move focus to the page on view change (not when only the drawer param changes).
  const lastView = useRef(route.view);
  useEffect(() => {
    if (lastView.current !== route.view) {
      lastView.current = route.view;
      window.scrollTo({ top: 0 });
      main.current?.focus({ preventScroll: true });
    }
  }, [route.view]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus(); }}>
        Skip to content
      </a>
      <Sidebar route={route} />
      <div className="main-col">
        <TopBar />
        <main id="main" className="content" ref={main} tabIndex={-1} style={{ outline: 'none' }} key={route.view}>
          <ViewBoundary resetKey={route.view}>
            <Content route={route} go={go} />
          </ViewBoundary>
          <footer className="foot">
            <span>LiftLab · uplift modeling for ad targeting</span>
            <span>Mock data from a seeded simulation · {EXPERIMENT.window}</span>
            <span>
              Demo states: <a href="?demo=slow#/overview">slow load</a> · <a href="?demo=error#/overview">load error</a> · <a href="?#/overview">normal</a>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
