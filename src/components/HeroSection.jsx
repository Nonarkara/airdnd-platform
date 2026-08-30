import { useEffect, useState } from 'react';
import { formatRelativeTimestamp } from '../lib/listings';
import PageBanner from './PageBanner';
import './HeroSection.css';

function HeroSection({ t, metrics, dataState, intakeSummary }) {
  const heroText = t?.hero || {};
  const labels = heroText.statLabels || {};
  const total = (metrics?.telegramCount || 0) + (metrics?.longdoCount || 0) || metrics?.total || 0;
  const provinces = metrics?.cityCount > 0 ? metrics.cityCount : 0;
  const faces = metrics?.uniqueNames > 0 ? metrics.uniqueNames : 0;
  const operators = metrics?.uniquePhones > 0 ? metrics.uniquePhones : 0;
  const longdo = metrics?.longdoCount > 0 ? metrics.longdoCount : 0;
  const channels = intakeSummary?.channelCount || metrics?.sourceChannelCount || 0;
  const photosMatched = metrics?.matchedMediaCount || 0;
  const lastSync = formatRelativeTimestamp(metrics?.latestTimestamp || dataState?.lastLoadedAt) || '—';

  const [corpus, setCorpus] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/insights.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.corpus) setCorpus(j.corpus);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const photosArchived = corpus?.photosArchived || photosMatched;
  const messages = corpus?.messagesTotal || 0;

  const stats = [
    { id: 'venues', label: labels.venues || 'Locations', value: total },
    { id: 'longdo', label: labels.longdo || 'Longdo POIs', value: longdo },
    { id: 'provinces', label: labels.provinces || 'Provinces', value: provinces },
    { id: 'faces', label: labels.faces || 'Named faces', value: faces },
    { id: 'operators', label: labels.operators || 'Telegram phones', value: operators },
    { id: 'photos', label: labels.photos || 'Photos archived', value: photosArchived },
    { id: 'messages', label: labels.messages || 'Channel messages', value: messages || channels },
  ];

  return (
    <PageBanner
      image="/heroes/directory.jpg"
      tone="light"
      ariaLabelledBy="masthead-title"
      className="masthead"
    >
      <p className="eyebrow masthead__eyebrow">
        {heroText.kicker || '01 — NATIONAL INVENTORY'}
      </p>
      <div className="masthead__row">
        <div className="masthead__copy">
          <h1 id="masthead-title" className="masthead__title">
            sabai<span className="masthead__dot">·</span>sabai
          </h1>
          <p className="masthead__sub">
            {heroText.subtitle
              || 'Complete inventory of massage parlours that reach our channels. Rank by who broadcasts. Read health context on the map — public epidemic, parlour corridor, worker access.'}
          </p>
          {heroText.summaryLine && (
            <p className="masthead__pulse">
              {heroText.summaryLine
                .replace('{venues}', total.toLocaleString())
                .replace('{provinces}', provinces.toLocaleString())
                .replace('{faces}', faces.toLocaleString())
                .replace('{photos}', Number(photosArchived).toLocaleString())}
            </p>
          )}
        </div>
        <dl className="masthead__stats" aria-label={heroText.panelLabel || 'Inventory snapshot'}>
          {stats.map((row) => (
            <div key={row.id}>
              <dt>{row.label}</dt>
              <dd className="mono">{Number(row.value).toLocaleString()}</dd>
            </div>
          ))}
          <div className="masthead__stats-wide">
            <dt>{labels.channels || 'Channels'}</dt>
            <dd className="mono">{channels.toLocaleString()}</dd>
          </div>
          <div className="masthead__stats-wide">
            <dt>{labels.synced || 'Synced'}</dt>
            <dd className="mono masthead__sync">{lastSync}</dd>
          </div>
        </dl>
      </div>
    </PageBanner>
  );
}

export default HeroSection;
