import { useMemo, useState, useEffect } from 'react';
import './InsightNarrative.css';

/**
 * InsightNarrative Engine
 * Synthesizes mathematical analytics into human-readable executive intelligence.
 * Focuses on psychological narratives: Urban Commoditization, Alpha Gravity, and High-Value Discretion.
 */
export default function InsightNarrative({ analytics, mode = 'spatial' }) {
  const [typedText, setTypedText] = useState('');
  
  const narrative = useMemo(() => {
    if (!analytics) return 'Awaiting spatial data stream...';

    const sentences = [];

    if (mode === 'spatial') {
      const { totalMentions, avgPrice, avgMentions, peakHour, topPerformers, bestValue, visibleCount } = analytics;
      
      if (visibleCount === 0) {
        return "The current viewport contains no known listings. The intelligence grid is offline for this sector.";
      }

      // Compute HHI (Herfindahl-Hirschman Index) based on mention share in the current viewport
      let hhi = 0;
      if (visibleCount > 0 && totalMentions > 0 && Array.isArray(topPerformers)) {
        let sumSquares = 0;
        topPerformers.forEach((p) => {
          const share = (p.computedMentions || 0) / totalMentions;
          sumSquares += (share * 100) ** 2;
        });
        hhi = Math.round(sumSquares);
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
          sentences.push(`We detect significant attention asymmetry radiating from "${top.name || 'a dominant player'}". Commanding a disproportionate ${top.computedMentions} mentions, this provider holds a strong local indexing advantage.`);
        } else {
          sentences.push(`Attention dynamics here are egalitarian; no single operator monopolizes the local feeds, leading to a fluid discovery landscape.`);
        }
      }

      // 3. Price Deviation from the Bangkok Median (฿1,800/hr)
      if (avgPrice) {
        const medianBaseline = 1800;
        const priceDev = Math.round(((avgPrice - medianBaseline) / medianBaseline) * 100);
        const devSign = priceDev >= 0 ? '+' : '';
        
        if (priceDev > 35) {
           sentences.push(`Pricing indicators point to a high price deviation (${devSign}${priceDev}% from Bangkok median, average: ฿${avgPrice.toLocaleString()}). Operators here trade volume for high-value discretion and premium placement.`);
        } else if (priceDev < -15) {
           sentences.push(`Pricing indicators show a negative price deviation (${priceDev}% from Bangkok median, average: ฿${avgPrice.toLocaleString()}), typical of high-velocity transit zones optimizing for rapid turnover.`);
        } else {
           sentences.push(`Pricing conforms to the city median (${devSign}${priceDev}% deviation, average: ฿${avgPrice.toLocaleString()}), reflecting stable middle-class threshold alignment.`);
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
          sentences.push(`Discovery is dangerously centralized into a singular echo chamber. A shift in one platform's algorithm could destabilize this entire ecosystem.`);
        }
      }

      if (mentionPower && mentionPower.alpha) {
        if (mentionPower.alpha > 1.2) {
          sentences.push(`We are witnessing a brutal Winner-Takes-All psychological paradigm (Power-Law α=${mentionPower.alpha}). The top 1% of providers are siphoning the vast majority of social capital and attention.`);
        } else {
          sentences.push(`The attention economy is surprisingly egalitarian (α=${mentionPower.alpha}), allowing mid-tier operators to carve out sustainable, loyal micro-communities.`);
        }
      }
      
      if (dataFreshnessHours !== undefined) {
        if (dataFreshnessHours < 2) {
          sentences.push(`Data vectors are hyper-fresh, reflecting immediate market psychology.`);
        } else {
          sentences.push(`The structural narrative remains stable, anchored by data collected ${dataFreshnessHours} hours ago.`);
        }
      }
    }

    return sentences.join(' ');
  }, [analytics, mode]);

  // Terminal-style Typewriter effect
  useEffect(() => {
    setTypedText('');
    let i = 0;
    const intervalId = setInterval(() => {
      setTypedText(narrative.substring(0, i));
      i++;
      if (i > narrative.length) clearInterval(intervalId);
    }, 15); // slightly slower for reading pacing
    
    return () => clearInterval(intervalId);
  }, [narrative]);

  if (!analytics) return null;

  return (
    <div className="insight-narrative-container professional-terminal">
      <div className="insight-narrative-header">
        <span className="live-dot pulse" />
        <span className="kicker">SABAI TERMINAL // PSYCHO-ANALYTICS</span>
      </div>
      <p className="insight-narrative-text">
        {typedText}
        <span className="cursor blink">|</span>
      </p>
    </div>
  );
}
