import { useMemo } from 'react';
import './InsightNarrative.css';

/**
 * InsightNarrative Engine
 * Synthesizes mathematical analytics into human-readable executive intelligence.
 * Focuses on psychological narratives: Urban Commoditization, Alpha Gravity, and High-Value Discretion.
 */
export default function InsightNarrative({ analytics, mode = 'spatial' }) {
  const narrative = useMemo(() => {
    if (!analytics) return 'Awaiting spatial data stream...';

    const sentences = [];

    if (mode === 'spatial') {
      const { avgPrice, avgMentions, peakHour, topPerformers, bestValue, visibleCount, priceMedian } = analytics;

      if (visibleCount === 0) {
        return "The current viewport contains no known listings. The intelligence grid is offline for this sector.";
      }

      // Compute HHI (Herfindahl-Hirschman Index) based on mention share in the current viewport
      let hhi = 0;
      let totalMentions = 0;
      if (visibleCount > 0 && Array.isArray(topPerformers)) {
        topPerformers.forEach((p) => {
          totalMentions += p.computedMentions || 0;
        });
        if (totalMentions > 0) {
          let sumSquares = 0;
          topPerformers.forEach((p) => {
            const share = (p.computedMentions || 0) / totalMentions;
            sumSquares += (share * 100) ** 2;
          });
          hhi = Math.round(sumSquares);
        }
      }

      // 1. Density & HHI Concentration
      if (hhi > 2500) {
        sentences.push(`This district exhibits a highly concentrated supply structure (HHI: ${hhi}). A few dominant channels monopolize attention, leaving the remaining ${visibleCount} locations to compete on residual local traffic.`);
      } else if (hhi > 1500) {
        sentences.push(`This sector maintains a moderately concentrated market (HHI: ${hhi}). Competition is balanced across ${visibleCount} active locations without extreme attention capture.`);
      } else {
        sentences.push(`A highly fragmented micro-market (HHI: ${hhi}). Social capital is widely distributed among the ${visibleCount} active providers, suggesting low entry barriers and high local differentiation.`);
      }

      // 2. The Alpha Gravity (Attention Capture)
      if (topPerformers && topPerformers.length > 0) {
        const top = topPerformers[0];
        if (top.computedMentions > (avgMentions || 0) * 2) {
          sentences.push(`"${top.name || 'a dominant player'}" pulls ${top.computedMentions} mentions, ${Math.round((top.computedMentions || 0) / (avgMentions || 1))}x the market average. Strong local indexing advantage.`);
        } else {
          sentences.push(`No single operator dominates the local feeds; discovery stays fluid across venues.`);
        }
      }

      // 3. Price Level Assessment
      if (avgPrice) {
        const medianBaseline = priceMedian || 1800;
        const priceDev = Math.round(((avgPrice - medianBaseline) / medianBaseline) * 100);
        const devSign = priceDev >= 0 ? '+' : '';

        if (priceDev > 35) {
           sentences.push(`Pricing indicators point to a premium level (${devSign}${priceDev}% above benchmark, average: ฿${avgPrice.toLocaleString()}). Operators here focus on high-value discretion and premium placement.`);
        } else if (priceDev < -15) {
           sentences.push(`Pricing indicators show a value-focused level (${priceDev}% below benchmark, average: ฿${avgPrice.toLocaleString()}), typical of high-velocity transit zones optimizing for rapid turnover.`);
        } else {
           sentences.push(`Pricing aligns with benchmark levels (${devSign}${priceDev}% deviation, average: ฿${avgPrice.toLocaleString()}), reflecting stable market positioning.`);
        }
      } else {
        sentences.push(`The lack of numeric price labels indicates a highly psychological, inquiry-based booking model designed to filter demand prior to contact.`);
      }

      // 4. Temporal Rhythms
      if (peakHour !== null && peakHour !== undefined) {
        if (peakHour >= 22 || peakHour <= 3) {
          sentences.push(`Temporal patterns indicate a late-night service rhythm, with message density peaking at ${peakHour}:00.`);
        } else if (peakHour >= 12 && peakHour <= 17) {
          sentences.push(`Contrarian temporal behavior is observed: message density peaks during daylight hours (${peakHour}:00), signaling mid-day operator shifts.`);
        } else {
          sentences.push(`The temporal rhythm aligns with standard after-hours decompression, peaking predictably at ${peakHour}:00.`);
        }
      }
    } else if (mode === 'global') {
      const { total, velocity, dataFreshnessHours, channelEntropy, mentionPower } = analytics;

      sentences.push(`The macro-intelligence grid is currently rendering ${total} active nodes.`);

      if (channelEntropy && channelEntropy.evenness) {
        if (channelEntropy.evenness > 0.7) {
          sentences.push(`The structural integrity of discovery is highly resilient (Entropy Evenness: ${Math.round(channelEntropy.evenness * 100)}%). Consumers are utilizing diverse, fragmented channels to navigate the market.`);
        } else {
          sentences.push(`Discovery is centralized into one echo chamber. A single platform's algorithm shift could destabilize the whole market.`);
        }
      }

      if (mentionPower && mentionPower.alpha) {
        if (mentionPower.alpha > 1.2) {
          sentences.push(`Winner-takes-all dynamics (Power-Law α=${mentionPower.alpha}). Top providers take most of the attention and social capital.`);
        } else {
          sentences.push(`The attention economy is surprisingly egalitarian (α=${mentionPower.alpha}), allowing mid-tier operators to carve out sustainable, loyal micro-communities.`);
        }
      }

      if (dataFreshnessHours !== undefined) {
        if (dataFreshnessHours < 2) {
          sentences.push(`Data is hyper-fresh; this read reflects the current market.`);
        } else {
          sentences.push(`The structural narrative remains stable, anchored by data collected ${dataFreshnessHours} hours ago.`);
        }
      }
    }

    return sentences.join(' ');
  }, [analytics, mode]);

  if (!analytics) return null;

  return (
    <div className="insight-narrative-container professional-terminal">
      <div className="insight-narrative-header">
        <span className="live-dot pulse" />
        <span className="kicker">MARKET READ // {mode === 'global' ? 'FULL CORPUS' : 'THIS VIEWPORT'}</span>
      </div>
      <p className="insight-narrative-text">
        {narrative}
      </p>
    </div>
  );
}
