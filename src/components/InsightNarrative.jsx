import { useMemo } from 'react';
import './InsightNarrative.css';

const pct = (x) => `${Math.round(x * 100)}%`;
const baht = (n) => `฿${Math.round(n).toLocaleString()}`;

/**
 * A plain read of the numbers on screen. It states what was measured and
 * stops there: no motives, no market psychology, nothing the data cannot
 * show. (It used to say things like "operators here focus on high-value
 * discretion" — sentences the counts behind them could never support.)
 */
export default function InsightNarrative({ analytics, mode = 'spatial' }) {
  const narrative = useMemo(() => {
    if (!analytics) return '';
    const sentences = [];

    if (mode === 'spatial') {
      const { avgPrice, avgMentions, peakHour, topPerformers, visibleCount, priceMedian } = analytics;
      if (!visibleCount) return 'No listings in this view. Zoom out or pick a city above.';

      sentences.push(`${visibleCount} listing${visibleCount === 1 ? '' : 's'} in view.`);

      const top = Array.isArray(topPerformers) ? topPerformers[0] : null;
      const totalMentions = (avgMentions || 0) * visibleCount;
      if (top && top.computedMentions > 0 && totalMentions > 0) {
        sentences.push(`The most-posted venue here, ${top.name || 'unnamed'}, accounts for ${pct(Math.min(1, top.computedMentions / totalMentions))} of all mentions in view (${top.computedMentions}).`);
      }

      if (avgPrice) {
        sentences.push(`Average posted rate ${baht(avgPrice)}${priceMedian ? `; across the whole directory the median is ${baht(priceMedian)}` : ''}. Listings without a rate are left out of both.`);
      } else {
        sentences.push('No listing in view posts a rate; prices are given on request.');
      }

      if (peakHour !== null && peakHour !== undefined) {
        sentences.push(`Posting peaks at ${String(peakHour).padStart(2, '0')}:00 Bangkok time.`);
      }
    } else if (mode === 'global') {
      const { total, dataFreshnessHours, channelEntropy, mentionPower } = analytics;
      sentences.push(`${total} listings in the directory.`);
      if (channelEntropy?.evenness) {
        sentences.push(`Spread of discovery across source channels: ${pct(channelEntropy.evenness)} evenness (100% would mean every channel carries the same share).`);
      }
      if (mentionPower?.alpha) {
        sentences.push(`Mentions per venue follow a power law with α = ${mentionPower.alpha}; the higher α, the more posts concentrate in a few venues.`);
      }
      if (dataFreshnessHours !== undefined) {
        sentences.push(`Newest data: ${dataFreshnessHours < 1 ? 'under an hour' : `${dataFreshnessHours} hour${dataFreshnessHours === 1 ? '' : 's'}`} old.`);
      }
    }

    return sentences.join(' ');
  }, [analytics, mode]);

  if (!analytics) return null;

  return (
    <div className="insight-narrative-container">
      <div className="insight-narrative-header">
        <span className="kicker">{mode === 'global' ? 'Whole directory' : 'In this view'}</span>
      </div>
      <p className="insight-narrative-text">
        {narrative}
      </p>
    </div>
  );
}
