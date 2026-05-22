import { useEffect, useRef, useState } from 'react';
import './MapMarketBar.css';

// Free API, no key: https://github.com/fawazahmed0/exchange-api
const API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

function delta(curr, prev) {
  if (prev === null || curr === null) return null;
  return curr > prev ? '▲' : curr < prev ? '▼' : '—';
}

function fmt(value, decimals = 0) {
  if (value === null) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export default function MapMarketBar() {
  const [data, setData] = useState(null);
  const prevRef = useRef(null);
  const [dir, setDir] = useState({ thb: null, btc: null, xau: null });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(API_URL);
        const json = await res.json();
        const usd = json?.usd;
        if (!usd) return;

        const next = {
          thb: usd.thb ?? null,
          btc: usd.btc ? Math.round(1 / usd.btc) : null,
          xau: usd.xau ? Math.round(1 / usd.xau) : null,
        };

        const prev = prevRef.current;
        setDir({
          thb: delta(next.thb, prev?.thb),
          btc: delta(next.btc, prev?.btc),
          xau: delta(next.xau, prev?.xau),
        });

        prevRef.current = next;
        setData(next);
      } catch {
        // fail silently — bar stays empty
      }
    }

    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="map-market-bar" aria-label="Market snapshot">
      <div className="map-market-tile">
        <span className="map-market-symbol">฿</span>
        <span className="map-market-value">{data ? fmt(data.thb, 2) : '—'}</span>
        {dir.thb && <span className={`map-market-dir ${dir.thb === '▲' ? 'up' : dir.thb === '▼' ? 'down' : ''}`}>{dir.thb}</span>}
        <span className="map-market-label">USD/THB</span>
      </div>
      <div className="map-market-tile">
        <span className="map-market-symbol">₿</span>
        <span className="map-market-value">{data ? `$${fmt(data.btc)}` : '—'}</span>
        {dir.btc && <span className={`map-market-dir ${dir.btc === '▲' ? 'up' : dir.btc === '▼' ? 'down' : ''}`}>{dir.btc}</span>}
        <span className="map-market-label">Bitcoin</span>
      </div>
      <div className="map-market-tile">
        <span className="map-market-symbol">Au</span>
        <span className="map-market-value">{data ? `$${fmt(data.xau)}` : '—'}</span>
        {dir.xau && <span className={`map-market-dir ${dir.xau === '▲' ? 'up' : dir.xau === '▼' ? 'down' : ''}`}>{dir.xau}</span>}
        <span className="map-market-label">Gold/oz</span>
      </div>
      <div className="map-market-tile">
        <span className="map-market-symbol">TH</span>
        <span className="map-market-value">2.9%</span>
        <span className="map-market-dir up">▲</span>
        <span className="map-market-label">GDP 2024</span>
      </div>
    </div>
  );
}
