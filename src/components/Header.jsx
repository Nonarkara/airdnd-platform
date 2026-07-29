import { Link } from 'react-router-dom';

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
  const isLive = sourceLabel?.toLowerCase().includes('live');
  const venueCount = metrics?.total || 0;

  const viewTabs = [
    { id: 'directory', label: t.nav?.listings || 'Inventory' },
    { id: 'feed', label: t.nav?.feed || 'Live' },
    { id: 'map', label: t.nav?.map || 'Map' },
  ];
  const linkTabs = [
    { id: 'health', label: t.nav?.health || 'HIV / STI', href: '/health' },
    { id: 'analytics', label: t.nav?.analytics || 'Analytics', href: '/analytics' },
    { id: 'methodology', label: t.nav?.methodology || 'Method', href: '/methodology' },
  ];

  return (
    <header className="site-header" id="overview">
      <div className="site-header__in">
        <a className="brand" href="#overview" aria-label="Sabai Sabai">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">sabai<em>·</em>sabai</span>
        </a>

        <nav className="nav" aria-label="Primary" role="tablist">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-link-btn${activeView === tab.id ? ' is-active' : ''}`}
              onClick={() => {
                if (document.startViewTransition) {
                  document.startViewTransition(() => setActiveView(tab.id));
                } else {
                  setActiveView(tab.id);
                }
              }}
              role="tab"
              aria-selected={activeView === tab.id}
              aria-controls={`${tab.id}-panel`}
            >
              {tab.label}
            </button>
          ))}
          {linkTabs.map((tab) => (
            <Link key={tab.id} to={tab.href} viewTransition role="tab" aria-selected={false}>
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="spacer" />

        <div className="header-actions">
          {venueCount > 0 && (
            <span className="status-pill mono">{venueCount} venues</span>
          )}
          <span className="status-pill" title={sourceLabel}>
            <span className="live-dot" style={!isLive ? { background: 'var(--ink-3)' } : undefined} />
            {isLive ? 'Live' : 'Cached'}
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

          <label className="header-select" aria-label="Theme">
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            >
              <option value="light">Paper</option>
              <option value="dark">Dark</option>
              <option value="high-contrast">High Contrast</option>
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
