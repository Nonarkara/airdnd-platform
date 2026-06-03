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

      // 1. Density & Commoditization (Urban Commoditization)
      if (visibleCount > 20) {
        sentences.push(`This district exhibits strong signs of Urban Commoditization. With ${visibleCount} active locations fiercely competing for attention (${totalMentions} total market mentions), providers are forced to differentiate heavily on price or specialized niches to survive the noise.`);
      } else if (visibleCount > 5) {
        sentences.push(`This sector maintains a balanced equilibrium. ${visibleCount} locations share the demand pool without triggering destructive price wars.`);
      } else {
        sentences.push(`A zone of High-Value Discretion. Scarcity defines this micro-market, allowing the ${visibleCount} operators here to command significant leverage over consumer choices.`);
      }

      // 2. The Alpha Gravity
      if (topPerformers && topPerformers.length > 0) {
        const top = topPerformers[0];
        if (top.computedMentions > (avgMentions || 0) * 2) {
          sentences.push(`We detect massive Alpha Gravity radiating from "${top.name || 'a dominant player'}". Commanding a disproportionate ${top.computedMentions} mentions, this apex provider essentially dictates the market standards and gravitational pull for the entire neighborhood.`);
        } else {
          sentences.push(`Influence here is democratized; no single entity monopolizes the narrative, leading to a highly fluid and competitive landscape.`);
        }
      }

      // 3. Socioeconomic Pricing & High-Value Discretion
      if (avgPrice) {
        if (avgPrice > 2500) {
           sentences.push(`Socioeconomic indicators point to a premium exclusionary zone (average rate: ฿${avgPrice.toLocaleString()}). Operators here are trading volume for prestige and curated anonymity.`);
        } else if (avgPrice < 1500) {
           sentences.push(`The baseline economic velocity is high, with prices aggressively anchored around ฿${avgPrice.toLocaleString()}, optimizing for rapid turnover and mass accessibility.`);
        } else {
           sentences.push(`Pricing is stabilized at ฿${avgPrice.toLocaleString()}, a standard middle-class threshold.`);
        }
      } else {
        sentences.push(`The absence of explicit numeric pricing suggests a highly psychological, inquiry-based economic model designed to screen clientele.`);
      }

      // 4. Temporal/Psychological Rhythms
      if (peakHour !== null && peakHour !== undefined) {
        if (peakHour >= 22 || peakHour <= 3) {
          sentences.push(`Psychologically, this district awakens under the cover of night, catering to late-hour escapism peaking at ${peakHour}:00.`);
        } else if (peakHour >= 12 && peakHour <= 17) {
          sentences.push(`Contrarian temporal behavior is observed: demand paradoxically peaks in broad daylight (${peakHour}:00), signaling a clientele seeking mid-day disruption.`);
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
