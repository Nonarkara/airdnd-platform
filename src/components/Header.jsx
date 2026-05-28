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
  const tabs = [
    { id: 'directory', label: t.nav?.listings || 'Directory' },
    { id: 'map', label: t.nav?.map || 'Map' },
    { id: 'feed', label: 'Live Feed' },
    { id: 'analytics', label: t.nav?.analytics || 'Analytics', href: '/analytics' },
    { id: 'methodology', label: t.nav?.methodology || 'Methodology', href: '/methodology' },
    { id: 'sociology', label: t.nav?.sociology || 'Sociology', href: '/sociology' },
  ];

  return (
    <header className="header" id="overview">
      <div className="brand-block">
        <span className="brand-mark">
          <span className="brand-circle" aria-hidden="true" />
        </span>
        <span className="brand-copy">
          <strong>SUB-I 2.0</strong>
          <small>{t.header?.tagline || 'INTELLIGENCE'}</small>
        </span>
      </div>

      <nav className="nav-links" aria-label="Primary" role="tablist">
        {tabs.map((tab) => {
          if (tab.href) {
            return (
              <Link key={tab.id} to={tab.href} className="nav-tab" role="tab" aria-selected={false}>
                {tab.label}
              </Link>
            );
          }
          return (
            <button
              key={tab.id}
              type="button"
              className={`nav-tab ${activeView === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveView(tab.id)}
              role="tab"
              aria-selected={activeView === tab.id}
              aria-controls={`${tab.id}-panel`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="header-actions">
        <span className={`source-chip${sourceLabel?.includes('fallback') || sourceLabel?.includes('backup') ? ' is-fallback' : ''}`}>
          {sourceLabel}
        </span>

        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (t.common?.refreshing || 'REFRESHING...') : (t.common?.refresh || 'REFRESH')}
        </button>

        <label className="language-picker">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label="Language"
          >
            <option value="en">EN</option>
            <option value="th">TH</option>
            <option value="zh">ZH</option>
            <option value="ko">KO</option>
          </select>
        </label>

        <label className="language-picker theme-picker" style={{ display: 'inline-flex' }}>
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            aria-label="Theme"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="hot-as-hell">Hot</option>
          </select>
        </label>

        {onLogout && (
          <button type="button" className="btn-ghost" onClick={onLogout}>
            {t.common?.logout || 'LOGOUT'}
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
