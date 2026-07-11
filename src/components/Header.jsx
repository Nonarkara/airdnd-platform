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
}) {
  const isLive = sourceLabel?.toLowerCase().includes('live');

  const viewTabs = [
    { id: 'directory', label: t.nav?.listings || 'Listings' },
    { id: 'map', label: t.nav?.map || 'Map' },
    { id: 'feed', label: 'Live Feed' },
  ];
  const linkTabs = [
    { id: 'analytics', label: t.nav?.analytics || 'Analytics', href: '/analytics' },
    { id: 'methodology', label: t.nav?.methodology || 'Methodology', href: '/methodology' },
    { id: 'sociology', label: t.nav?.sociology || 'Field Notes', href: '/sociology' },
    { id: 'paper', label: t.pageChrome?.researchPaper || t.pageChrome?.workingPaper || 'Paper', href: '/paper' },
    { id: 'faq', label: t.nav?.faq || 'FAQ', href: '/faq' },
    { id: 'matching', label: t.nav?.matching || 'The Match', href: '/matching' },
    { id: 'trends', label: t.nav?.trends || 'Trends', href: '/trends' },
  ];

  return (
    <>
      {/* TOPBAR TICKER — the data heartbeat as editorial dateline */}
      <div className="topbar">
        <div className="topbar__track">
          <span><span className="live-dot" style={!isLive ? { background: 'var(--gold)' } : undefined} />&nbsp; {isLive ? 'Pipeline live' : 'Cached view'}</span>
          <span className="sep">/</span>
          <span>Telegram → AI → Directory</span>
          <span className="sep">/</span>
          <span>{sourceLabel || 'Research prototype'}</span>
          <span className="sep">/</span>
          <span>Research prototype · v2.0</span>
        </div>
      </div>

      <header className="site-header" id="overview">
        <div className="site-header__in">
          <a className="brand" href="#overview" aria-label="Sabai Sabai">
            <svg className="brand__mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" style={{ fill: 'var(--mango)' }} />
              <circle cx="16" cy="12.5" r="4.8" style={{ fill: 'var(--bg)' }} />
              <path d="M6 21.5c2.5-2.3 5-2.3 7.5 0s5 2.3 7.5 0 3.6-1.6 3.6-1.6" style={{ stroke: 'var(--bg)' }} strokeWidth="2" strokeLinecap="round" />
            </svg>
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
            <span className="status-pill" title={sourceLabel}>
              <span className="live-dot" style={!isLive ? { background: 'var(--gold)' } : undefined} />
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
                aria-label={t.common?.language || 'Language'}
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
                aria-label="Theme"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
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
    </>
  );
}

export default Header;
