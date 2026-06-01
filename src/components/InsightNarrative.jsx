import { useMemo, useState, useEffect } from 'react';
import './InsightNarrative.css';

/**
 * InsightNarrative Engine
 * Synthesizes mathematical analytics into human-readable executive intelligence.
 */
export default function InsightNarrative({ analytics, mode = 'spatial' }) {
  const [typedText, setTypedText] = useState('');
  
  const narrative = useMemo(() => {
    if (!analytics) return 'Awaiting spatial data stream...';

    const sentences = [];

    if (mode === 'spatial') {
      const { totalMentions, avgPrice, avgMentions, peakHour, topPerformers, bestValue, visibleCount } = analytics;
      
      if (visibleCount === 0) {
        return "The current viewport contains no known listings. Pan to a populated district to synthesize intelligence.";
      }

      // Sentence 1: General volume and density
      if (visibleCount > 20) {
        sentences.push(`This district is highly saturated, currently rendering ${visibleCount} distinct locations with a combined popularity of ${totalMentions} mentions.`);
      } else {
        sentences.push(`This is a specialized zone with ${visibleCount} locations detected.`);
      }

      // Sentence 2: The Alphas
      if (topPerformers && topPerformers.length > 0) {
        const top = topPerformers[0];
        sentences.push(`The market here is heavily anchored by "${top.name || 'a primary provider'}", which commands significant attention (${top.computedMentions} mentions).`);
      }

      // Sentence 3: Economics & Value
      if (avgPrice) {
        sentences.push(`Pricing is stabilized around ฿${avgPrice.toLocaleString()}.`);
        if (bestValue && bestValue.priceValue) {
          const discount = Math.round((1 - (bestValue.priceValue / avgPrice)) * 100);
          if (discount > 10) {
            sentences.push(`However, the mathematical value index flags "${bestValue.name || 'a location'}" as highly undervalued, operating at a ${discount}% discount to the regional average while maintaining strong demand.`);
          } else {
            sentences.push(`The value index confirms pricing is highly correlated with popularity, with "${bestValue.name || 'a location'}" achieving optimal market efficiency.`);
          }
        }
      } else {
        sentences.push(`Numeric pricing signals are scarce in this zone, suggesting an inquiry-based economic model.`);
      }

      // Sentence 4: Temporal
      if (peakHour !== null && peakHour !== undefined) {
        if (peakHour >= 22 || peakHour <= 3) {
          sentences.push(`Activity models indicate this is a late-night hub, with operational overlap peaking at ${peakHour}:00.`);
        } else if (peakHour >= 12 && peakHour <= 17) {
          sentences.push(`Unusually, this area functions as a daytime market, peaking at ${peakHour}:00.`);
        } else {
          sentences.push(`Demand and operations peak reliably around ${peakHour}:00.`);
        }
      }
    } else if (mode === 'global') {
      const { total, velocity, dataFreshnessHours, channelEntropy, mentionPower } = analytics;
      
      sentences.push(`The intelligence grid is tracking ${total} total operations.`);
      
      if (velocity > 0) {
        sentences.push(`Market velocity remains strong with a ${velocity}% daily intake rate.`);
      }

      if (channelEntropy && channelEntropy.evenness) {
        if (channelEntropy.evenness > 0.7) {
          sentences.push(`Discovery channels exhibit high entropy (${Math.round(channelEntropy.evenness * 100)}% evenness), meaning operations are evenly dispersed across multiple networks rather than concentrated in a single echo chamber.`);
        } else {
          sentences.push(`Discovery is highly concentrated, with a single network driving most of the signal.`);
        }
      }

      if (mentionPower && mentionPower.alpha) {
        if (mentionPower.alpha > 1.2) {
          sentences.push(`Attention follows a strict power-law (α=${mentionPower.alpha}), indicating a winner-takes-all environment where top Alphas dominate the narrative.`);
        } else {
          sentences.push(`The attention economy is relatively flat (α=${mentionPower.alpha}), allowing a long tail of mid-tier providers to sustain steady demand.`);
        }
      }
      
      if (dataFreshnessHours !== undefined) {
        if (dataFreshnessHours < 2) {
          sentences.push(`Data vectors are hyper-fresh, updated less than 2 hours ago.`);
        } else {
          sentences.push(`Information architecture is stable, last synced ${dataFreshnessHours} hours ago.`);
        }
      }
    }

    return sentences.join(' ');
  }, [analytics, mode]);

  // Typewriter effect
  useEffect(() => {
    setTypedText('');
    let i = 0;
    const intervalId = setInterval(() => {
      setTypedText(narrative.substring(0, i));
      i++;
      if (i > narrative.length) clearInterval(intervalId);
    }, 12);
    
    return () => clearInterval(intervalId);
  }, [narrative]);

  if (!analytics) return null;

  return (
    <div className="insight-narrative-container">
      <div className="insight-narrative-header">
        <span className="live-dot" />
        <span className="kicker">LIVE SYNTHESIS</span>
      </div>
      <p className="insight-narrative-text">
        {typedText}
        <span className="cursor">|</span>
      </p>
    </div>
  );
}
