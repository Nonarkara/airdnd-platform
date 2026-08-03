import { useEffect, useMemo, useRef } from 'react';
import './DistrictComparisonDrawer.css';

export default function DistrictComparisonDrawer({ listings, isOpen, onClose, onSelectDistrict, t }) {
  const districtStats = useMemo(() => {
    if (!Array.isArray(listings) || listings.length === 0) return [];

    const map = new Map();

    for (const item of listings) {
      const distName = item.city || 'Bangkok';
      if (!map.has(distName)) {
        map.set(distName, {
          name: distName,
          count: 0,
          totalPrice: 0,
          priceCount: 0,
          photosCount: 0,
          channels: new Map(),
        });
      }

      const stat = map.get(distName);
      stat.count += 1;

      if (typeof item.priceValue === 'number' && item.priceValue > 0) {
        stat.totalPrice += item.priceValue;
        stat.priceCount += 1;
      }

      if (item.photoUrls?.length || item.image_url) {
        stat.photosCount += 1;
      }

      const srcCh = item.sourceChannel || 'Broadsheet Intake';
      stat.channels.set(srcCh, (stat.channels.get(srcCh) || 0) + (item.mentionCount || 1));
    }

    return Array.from(map.values())
      .map((stat) => {
        let topChannel = 'Direct Feed';
        let topChanCount = 0;
        for (const [ch, c] of stat.channels.entries()) {
          if (c > topChanCount) {
            topChanCount = c;
            topChannel = ch;
          }
        }

        const avgPrice = stat.priceCount > 0 ? Math.round(stat.totalPrice / stat.priceCount) : null;
        const photoPct = Math.round((stat.photosCount / stat.count) * 100);

        return {
          name: stat.name,
          count: stat.count,
          avgPrice,
          photoPct,
          topChannel: topChannel.replace(/^@/, ''),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [listings]);

  const drawerRef = useRef(null);
  const ddt = t?.districtDrawer || {};
  const leadTemplate = ddt.lead || 'Comparative metrics across {count} district clusters.';
  const leadText = leadTemplate.replace('{count}', districtStats.length);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeBtn = drawerRef.current?.querySelector('.district-close-btn');
    closeBtn?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="district-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="district-drawer-title"
    >
      <div
        className="district-drawer-content"
        onClick={(e) => e.stopPropagation()}
        ref={drawerRef}
      >
        <header className="district-drawer-header">
          <div>
            <span className="district-drawer-kicker">{ddt.kicker}</span>
            <h2 className="district-drawer-title" id="district-drawer-title">
              {ddt.title}
            </h2>
          </div>
          <button
            type="button"
            className="district-close-btn"
            onClick={onClose}
            aria-label={t?.modal?.close || 'Close'}
          >
            ×
          </button>
        </header>

        <p className="district-drawer-lead">{leadText}</p>

        <div className="district-table-container">
          <table className="district-matrix-table">
            <thead>
              <tr>
                <th>{ddt.colName}</th>
                <th>{ddt.colVenues}</th>
                <th>{ddt.colRate}</th>
                <th>{ddt.colPhoto}</th>
                <th>{ddt.colChannel}</th>
                <th>{ddt.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {districtStats.map((dist) => (
                <tr key={dist.name}>
                  <td className="dist-col-name">{dist.name}</td>
                  <td className="dist-col-num">
                    {dist.count.toLocaleString()} {ddt.venuesUnit}
                  </td>
                  <td className="dist-col-price">
                    {dist.avgPrice ? `฿${dist.avgPrice.toLocaleString()} / hr` : ddt.rateOnRequest}
                  </td>
                  <td className="dist-col-photo">
                    <span className="dist-photo-bar">
                      <span className="dist-photo-fill" style={{ width: `${dist.photoPct}%` }} />
                    </span>
                    {dist.photoPct}%
                  </td>
                  <td className="dist-col-channel">@{dist.topChannel}</td>
                  <td className="dist-col-action">
                    <button
                      type="button"
                      className="dist-filter-btn"
                      onClick={() => {
                        onSelectDistrict(dist.name);
                        onClose();
                      }}
                    >
                      {ddt.filterBtn} →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
