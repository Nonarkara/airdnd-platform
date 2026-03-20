function Header({
  language,
  setLanguage,
  t,
  onLogout,
  onRefresh,
  isRefreshing,
  sourceLabel,
}) {
  return (
    <header className="header" id="overview">
      <a className="brand-block" href="#overview" aria-label="Sabai Sabai">
        <span className="brand-mark">SS</span>
        <span className="brand-copy">
          <strong>Sabai Sabai</strong>
          <small>{t.header.tagline}</small>
        </span>
      </a>

      <nav className="nav-links" aria-label="Primary">
        <a href="#map">{t.nav.map}</a>
        <a href="#workflow">{t.nav.workflow}</a>
        <a href="#live-listings">{t.nav.listings}</a>
      </nav>

      <div className="header-actions">
        <span className="status-pill header-status">{sourceLabel}</span>

        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? t.common.refreshing : t.common.refresh}
        </button>

        <label className="language-picker">
          <span>{t.common.language}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label={t.common.language}
          >
            <option value="en">EN</option>
            <option value="th">TH</option>
            <option value="zh">ZH</option>
            <option value="ko">KO</option>
          </select>
        </label>

        {onLogout && (
          <button type="button" className="btn-ghost" onClick={onLogout}>
            {t.common.logout}
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
