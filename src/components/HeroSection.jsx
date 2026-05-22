import { formatRelativeTimestamp } from '../lib/listings';
import './HeroSection.css';

function formatSync(value) {
  return value ? formatRelativeTimestamp(value) : 'Pending';
}

const HeroSection = ({ t, metrics, dataState, intakeSummary }) => {
  const heroText = t?.hero || {};
  const metricLabels = heroText.metricLabels || {};
  const verifiedCount = metrics?.total || 0;
  const summary = (heroText.summary || '{count} listings across {cities} cities. {events} intake events in the last 60 minutes.')
    .replace('{count}', verifiedCount.toLocaleString())
    .replace('{cities}', (metrics?.cityCount || 0).toLocaleString())
    .replace('{events}', (intakeSummary?.last60Minutes || 0).toLocaleString());

  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="hero-system">{heroText.system || 'Live community intelligence'}</p>
        <h1 className="hero-title">{heroText.title || 'Live wellness intelligence, cleaned for humans.'}</h1>
        <p className="hero-sub">{summary}</p>
      </div>

      <div className="hero-status-card">
        <div className="hero-status-top">
          <span>{dataState?.sourceLabel || heroText.statusFallback || 'System status'}</span>
          <strong>{dataState?.isRefreshing ? heroText.sync || 'Syncing' : heroText.live || 'Live'}</strong>
        </div>
        <p>{dataState?.note || heroText.initializing || 'Initializing data streams...'}</p>
        {dataState?.warning && <small>{dataState.warning}</small>}
      </div>

      <div className="hero-metrics">
        <article className="hero-metric hero-metric-primary">
          <span>{metricLabels.total || 'Total entries'}</span>
          <strong>{verifiedCount}</strong>
        </article>
        <article className="hero-metric hero-metric-secondary">
          <span>{metricLabels.photos || 'Photo match'}</span>
          <strong>{`${metrics?.mediaRate || 0}%`}</strong>
        </article>
        <article className="hero-metric hero-metric-secondary">
          <span>{metricLabels.channels || 'Active channels'}</span>
          <strong>{intakeSummary?.channelCount || 0}</strong>
        </article>
        <article className="hero-metric hero-metric-tertiary">
          <span>{metricLabels.sync || 'Last sync'}</span>
          <strong>{formatSync(metrics?.latestTimestamp || dataState?.lastLoadedAt)}</strong>
        </article>
      </div>
    </section>
  );
};

export default HeroSection;
