import { useMemo, useState } from 'react';
import CompanionCard from './CompanionCard';
import './CompanionGrid.css';

function SkeletonCard({ tall = false }) {
  return (
    <div className={`skeleton-card${tall ? ' skeleton-card-tall' : ''}`} aria-hidden="true">
      <div className="skeleton skeleton-media" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-row" />
    </div>
  );
}

function MiniBars({ count = 16, tone = 'cyan' }) {
  return (
    <div className={`mini-bars mini-bars-${tone}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          style={{ height: `${28 + ((index * 17) % 58)}%` }}
        />
      ))}
    </div>
  );
}

function MetricModule({ label, value, note, tone = 'cyan' }) {
  return (
    <article className={`intel-card intel-card-${tone}`}>
      <span className="intel-label">{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
      <MiniBars tone={tone} />
    </article>
  );
}

function ChannelModule({ intakeSummary }) {
  const leaders = intakeSummary?.channelLeaders || [];
  const top = intakeSummary?.topChannel;

  return (
    <article className="intel-card intel-card-channel">
      <span className="intel-label">Channel coverage</span>
      <strong>{intakeSummary?.channelCount || 0} / 12</strong>
      <p>{top ? `${top.channel} is driving ${top.count} listings` : 'Waiting for channel mix'}</p>
      <div className="channel-bars">
        {leaders.length > 0 ? leaders.map((channel) => (
          <div key={channel.channel} className="channel-row">
            <span>{channel.channel}</span>
            <div><i style={{ width: `${Math.max(channel.share, 5)}%` }} /></div>
            <em>{channel.share}%</em>
          </div>
        )) : (
          <div className="channel-row is-empty">
            <span>No live leaders yet</span>
            <div><i style={{ width: '8%' }} /></div>
            <em>0%</em>
          </div>
        )}
      </div>
    </article>
  );
}

function FlowModule({ intakeSummary }) {
  return (
    <article className="intel-card intel-card-flow">
      <span className="intel-label">Data flow</span>
      <div className="flow-stack">
        <div><strong>Telegram</strong><span>{intakeSummary?.channelCount || 0} sources</span></div>
        <div><strong>AI extraction</strong><span>Gemini enrich + sweep</span></div>
        <div><strong>Database</strong><span>Deduped + verified</span></div>
      </div>
      <p>New source posts become normalized cards and map points.</p>
    </article>
  );
}

function TopSourceModule({ intakeSummary }) {
  const top = intakeSummary?.topChannel;

  return (
    <article className="intel-card intel-card-purple">
      <span className="intel-label">Top source (24h)</span>
      <strong>{top?.channel || 'Pending'}</strong>
      <p>{top ? `${top.count} listings in the current feed window` : 'No source has taken the lead yet.'}</p>
      <div className="source-meter">
        <span style={{ width: `${top ? 68 : 8}%` }} />
      </div>
    </article>
  );
}

function buildFeedItems(listings, modules) {
  const positions = new Map([
    [1, modules[0]],
    [3, modules[1]],
    [6, modules[2]],
    [9, modules[3]],
    [13, modules[4]],
  ]);

  const items = [];
  listings.forEach((listing, index) => {
    items.push({ type: 'listing', id: `listing-${listing.id}`, listing, index });
    const module = positions.get(index);
    if (module) items.push(module);
  });

  return items;
}

function CompanionGrid({
  companions,
  onCardClick,
  t,
  metrics,
  intakeSummary,
  dataState,
  onClearFilters,
  hasActiveFilters,
  isLoading,
}) {
  const [visibleCount, setVisibleCount] = useState(48);
  const modules = useMemo(() => ([
    {
      type: 'metric',
      id: 'intel-match-rate',
      element: (
        <MetricModule
          label="Matched photo rate"
          value={`${metrics?.mediaRate || 0}%`}
          note={`${metrics?.matchedMediaCount || 0} of ${metrics?.total || 0} listings carry real media`}
          tone="lime"
        />
      ),
    },
    {
      type: 'channel',
      id: 'intel-channel',
      element: <ChannelModule intakeSummary={intakeSummary} />,
    },
    {
      type: 'metric',
      id: 'intel-velocity',
      element: (
        <MetricModule
          label="Intake velocity"
          value={`${intakeSummary?.throughputPerHour || 0}/hr`}
          note={`${intakeSummary?.last60Minutes || 0} source posts in the last 60 minutes`}
          tone="pink"
        />
      ),
    },
    {
      type: 'flow',
      id: 'intel-flow',
      element: <FlowModule intakeSummary={intakeSummary} />,
    },
    {
      type: 'source',
      id: 'intel-source',
      element: <TopSourceModule intakeSummary={intakeSummary} />,
    },
  ]), [intakeSummary, metrics]);

  const visibleListings = companions.slice(0, visibleCount);
  const feedItems = useMemo(
    () => buildFeedItems(visibleListings, modules),
    [modules, visibleListings],
  );

  return (
    <div className="companion-grid-container">
      {isLoading && companions.length === 0 ? (
        <div className="companion-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} tall={i % 3 === 0} />
          ))}
        </div>
      ) : companions.length === 0 ? (
        <div className="grid-state-card">
          <span className="intel-label">{dataState?.sourceLabel || 'Directory'}</span>
          <h3>{t.featured.emptyTitle}</h3>
          <p>{t.featured.emptyBody}</p>
          {hasActiveFilters && (
            <button type="button" className="btn-load-more" onClick={onClearFilters}>
              {t.featured.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="companion-grid">
            {feedItems.map((item) => (
              <div
                key={item.id}
                className={`card-entrance ${item.type !== 'listing' ? 'masonry-intel-item' : ''}`}
              >
                {item.type === 'listing' ? (
                  <CompanionCard
                    companion={item.listing}
                    onClick={onCardClick}
                    t={t}
                    priority={item.index < 4}
                  />
                ) : item.element}
              </div>
            ))}
          </div>

          {visibleCount < companions.length && (
            <div className="load-more-container">
              <button
                type="button"
                className="btn-load-more"
                onClick={() => setVisibleCount((current) => current + 24)}
              >
                {t.featured.showMore} ({companions.length - visibleCount} {t.featured.hidden})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CompanionGrid;
