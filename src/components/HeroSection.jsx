import { formatRelativeTimestamp } from '../lib/listings';
import './HeroSection.css';

function HeroSection({ t, metrics, dataState, intakeSummary }) {
  const heroText = t?.hero || {};
  const total = (metrics?.total && metrics.total > 0) ? metrics.total : 0;
  const provinces = (metrics?.cityCount && metrics.cityCount > 0) ? metrics.cityCount : 0;
  const channels = intakeSummary?.channelCount || 0;
  const lastSync = formatRelativeTimestamp(metrics?.latestTimestamp || dataState?.lastLoadedAt) || '—';

  return (
    <section className="masthead" aria-labelledby="masthead-title">
      <div className="wrap masthead__in">
        <p className="eyebrow masthead__eyebrow">
          {heroText.kicker || 'NATIONAL INVENTORY · TELEGRAM INTAKE'}
        </p>
        <div className="masthead__row">
          <div className="masthead__copy">
            <h1 id="masthead-title" className="masthead__title">
              sabai<span className="masthead__dot">·</span>sabai
            </h1>
            <p className="masthead__sub">
              Complete inventory of massage parlours in Thailand that reach our channels.
              Live posts carry promotions, availability, and new faces — ranked by who broadcasts most.
            </p>
          </div>
          <dl className="masthead__stats" aria-label="Inventory snapshot">
            <div>
              <dt>Venues</dt>
              <dd className="mono">{total.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Provinces</dt>
              <dd className="mono">{provinces.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Channels</dt>
              <dd className="mono">{channels.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Synced</dt>
              <dd className="mono masthead__sync">{lastSync}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
