import { Link, useLocation, useNavigate } from 'react-router-dom';

/**
 * Sticky chrome is navigation + status only.
 * NEVER put "sabai·sabai" (or any brand wordmark) in this header when the
 * page hero already carries the brand — stacked duplicate logos on one
 * viewport read amateur. Brand lives in the hero. See tasks/lessons.md
 * 2026-08-03 · Duplicate brand wordmark.
 *
 * View tabs push real history (/, /?view=feed, /map) so the browser Back
 * button returns to the prior page. Do not invent an in-page
 * "Back to Directory" control — that is the browser's job.
 */
function Header({
  language,
  setLanguage,
  t,
  onLogout,
  onRefresh,
  isRefreshing,
  sourceLabel,
  theme,
  setTheme,
  activeView,
  setActiveView,
  metrics,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isLive = sourceLabel?.toLowerCase().includes('live');
  const venueCount = metrics?.uniquePhones || metrics?.total || 0;
  const status = t.status || {};
  const themes = t.themes || {};

  const viewTabs = [
    { id: 'directory', label: t.nav?.listings || 'Inventory', to: '/' },
    { id: 'feed', label: t.nav?.feed || 'Live', to: '/?view=feed' },
    { id: 'map', label: t.nav?.map || 'Map', to: '/map' },
  ];
  const linkTabs = [
    { id: 'intel', label: t.nav?.intel || 'Intel', href: '/intel' },
    { id: 'insights', label: t.nav?.insights || 'Insights', href: '/insights' },
    { id: 'health', label: t.nav?.health || 'HIV / STI', href: '/health' },
    { id: 'publicworks', label: t.nav?.publicWorks || 'Public Works', href: '/public-works' },
    { id: 'places', label: t.nav?.places || 'Photos', href: '/places' },
    { id: 'analytics', label: t.nav?.analytics || 'Analytics', href: '/analytics' },
    { id: 'methodology', label: t.nav?.methodology || 'Method', href: '/methodology' },
  ];

  const goView = (tab) => {
    const run = () => {
      setActiveView?.(tab.id);
      const target = tab.to;
      const alreadyHome = location.pathname === '/' || location.pathname === '';
      if (tab.id === 'map') {
        if (location.pathname !== '/map') navigate('/map');
        return;
      }
      if (tab.id === 'feed') {
        if (!(alreadyHome && location.search === '?view=feed')) navigate('/?view=feed');
        return;
      }
      if (!(alreadyHome && (location.search === '' || location.search === '?'))) {
        navigate('/');
      }
    };
    if (document.startViewTransition) {
      document.startViewTransition(run);
    } else {
      run();
    }
  };

  const currentPath = location.pathname;
  const isLinkActive = (href) => currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <header className="site-header" id="overview">
      <div className="site-header__in site-header__in--nav-first">
        <nav className="nav" aria-label={t.nav?.primary || 'Primary'} role="tablist">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-link-btn${activeView === tab.id ? ' is-active' : ''}`}
              onClick={() => goView(tab)}
              role="tab"
              aria-selected={activeView === tab.id}
              aria-controls={`${tab.id}-panel`}
            >
              {tab.label}
            </button>
          ))}
          {linkTabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.href}
              viewTransition
              role="tab"
              aria-selected={isLinkActive(tab.href)}
              className={isLinkActive(tab.href) ? 'is-active' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="spacer" />

        <div className="header-actions">
          {venueCount > 0 && (
            <span className="status-pill mono">
              {venueCount} {status.venues || 'venues'}
            </span>
          )}
          <span className="status-pill" title={sourceLabel}>
            <span className="live-dot" style={!isLive ? { background: 'var(--ink-3)' } : undefined} />
            {isLive ? (status.live || 'Live') : (status.cached || 'Cached')}
          </span>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (t.common?.refreshing || 'Refreshing…') : (t.common?.refresh || 'Refresh')}
          </button>

          <label className="header-select" aria-label={t.common?.language || 'Language'}>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="en">EN</option>
              <option value="th">TH</option>
              <option value="zh">ZH</option>
              <option value="ko">KO</option>
            </select>
          </label>

          <label className="header-select" aria-label={themes.label || 'Theme'}>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            >
              <option value="light">{themes.paper || 'Paper'}</option>
              <option value="dark">{themes.dark || 'Dark'}</option>
              <option value="high-contrast">{themes.highContrast || 'High Contrast'}</option>
            </select>
          </label>

          {onLogout && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>
              {t.common?.logout || 'Logout'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
