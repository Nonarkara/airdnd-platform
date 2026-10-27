import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatRelativeTimestamp } from '../lib/listings';
import PageBanner from './PageBanner';
import './HeroSection.css';

function HeroSection({ t, metrics, dataState, intakeSummary }) {
  const heroText = t?.hero || {};
  const labels = heroText.statLabels || {};
  const total = metrics?.uniquePhones > 0 ? metrics.uniquePhones : (metrics?.total > 0 ? metrics.total : 0);
  const provinces = metrics?.cityCount > 0 ? metrics.cityCount : 0;
  const faces = metrics?.uniqueNames > 0 ? metrics.uniqueNames : 0;
  const operators = metrics?.total > 0 ? metrics.total : 0;
  const channels = intakeSummary?.channelCount || metrics?.sourceChannelCount || 0;
  const photosMatched = metrics?.matchedMediaCount || 0;
  const lastSync = formatRelativeTimestamp(metrics?.latestTimestamp || dataState?.lastLoadedAt) || '—';

  const [corpus, setCorpus] = useState(null);
  // The intake funnel written by scripts/verify_snapshot.js at build time: how
  // many cards ship, how many of their photos are actually deployable, how old
  // the newest post is. The archive-scale numbers above are true; this line is
  // what keeps them honest.
  const [funnel, setFunnel] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/insights.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.corpus) setCorpus(j.corpus);
      })
      .catch(() => {});
    fetch('/funnel.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.shown) setFunnel(j);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const photosArchived = corpus?.photosArchived || photosMatched;
  const messages = corpus?.messagesTotal || 0;

  const fill = (template, values) =>
    Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, String(value)), template);
  const liveSource = dataState?.sourceLabel || dataState?.source || '—';
  const provenanceLine = funnel
    ? fill(
      heroText.provenance
          || 'Showing {cards} cards · {photosOk} of {photosRef} card photos ship in this build · newest post {ageDays} days ago · live source: {source}',
      {
        cards: funnel.shown.cards.toLocaleString(),
        photosOk: funnel.shown.deployablePhotoCards.toLocaleString(),
        photosRef: funnel.shown.withPhoto.toLocaleString(),
        ageDays: funnel.snapshot.ageDays ?? '—',
        source: liveSource,
      },
    )
    : null;
  const archiveLine = funnel?.archive?.businesses
    ? fill(
      heroText.provenanceMerge
          || '{personaPosts} persona posts merged into {businesses} businesses by phone number.',
      {
        messages: Number(funnel.archive.messages || 0).toLocaleString(),
        photos: Number(funnel.archive.photos || 0).toLocaleString(),
        personaPosts: Number(funnel.archive.personaPosts || 0).toLocaleString(),
        businesses: Number(funnel.archive.businesses || 0).toLocaleString(),
      },
    )
    : null;

  const stats = [
    { id: 'venues', label: labels.venues || 'Venues', value: total },
    { id: 'provinces', label: labels.provinces || 'Provinces', value: provinces },
    { id: 'faces', label: labels.faces || 'Named faces', value: faces },
    { id: 'operators', label: labels.operators || 'Operators', value: operators },
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
          {/* The counts live once, in the panel beside this copy. A summary
              line repeating them, and an archive line repeating them again,
              read three times in one viewport. */}
          {provenanceLine && (
            <p className="masthead__provenance mono" role="status">
              {provenanceLine}
              {archiveLine && (
                <>
                  <br />
                  {archiveLine}
                </>
              )}
            </p>
          )}
          <div className="masthead__cta-row">
            <Link to="/places" className="masthead__cta">
              <span>{heroText.photosCta || 'Browse the full photo archive'}</span>
              <span className="masthead__cta-arrow">→</span>
            </Link>
          </div>
        </div>
        <dl className="masthead__stats" aria-label={heroText.panelLabel || 'Inventory snapshot'}>
          {stats.map((row) => (
            <div key={row.id} className={row.id === 'photos' ? 'masthead__stat masthead__stat--link' : ''}>
              {row.id === 'photos' ? (
                <Link to="/places" className="masthead__stat-link">
                  <dt>{row.label}</dt>
                  <dd className="mono">{Number(row.value).toLocaleString()}</dd>
                </Link>
              ) : (
                <>
                  <dt>{row.label}</dt>
                  <dd className="mono">{Number(row.value).toLocaleString()}</dd>
                </>
              )}
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
