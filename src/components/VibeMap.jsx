import { useMemo } from 'react';
import './VibeMap.css';

const BANGKOK_AREAS = [
  { key: 'sukhumvit', patterns: ['สุขุมวิท', 'sukhumvit', 'asoke', 'อโศก', 'nana', 'นานา', 'phrom phong', 'พร้อมพงษ์'] },
  { key: 'thonglor', patterns: ['ทองหล่อ', 'thonglor', 'thong lo', 'ekkamai', 'เอกมัย'] },
  { key: 'silom', patterns: ['สีลม', 'silom', 'สาทร', 'sathorn', 'sala daeng', 'ศาลาแดง'] },
  { key: 'ratchada', patterns: ['รัชดา', 'ratchada', 'huai khwang', 'ห้วยขวาง', 'din daeng', 'ดินแดง'] },
  { key: 'ladprao', patterns: ['ลาดพร้าว', 'ladprao', 'lat phrao', 'โชคชัย', 'chokchai'] },
  { key: 'rama2', patterns: ['พระราม 2', 'พระราม2', 'rama 2', 'rama2'] },
  { key: 'rama9', patterns: ['พระราม 9', 'พระราม9', 'rama 9', 'rama9', 'ramkhamhaeng', 'รามคำแหง'] },
  { key: 'bangna', patterns: ['บางนา', 'bang na', 'bangna', 'bearing', 'แบริ่ง', 'srinakarin', 'ศรีนครินทร์'] },
  { key: 'bangkapi', patterns: ['บางกะปิ', 'bangkapi', 'bang kapi', 'the mall'] },
  { key: 'chatuchak', patterns: ['จตุจักร', 'chatuchak', 'lat yao', 'ลาดยาว', 'phahon', 'พหล'] },
  { key: 'pattaya', patterns: ['พัทยา', 'pattaya', 'ชลบุรี', 'chonburi', 'jomtien'] },
  { key: 'chiangmai', patterns: ['เชียงใหม่', 'chiang mai', 'chiangmai'] },
  { key: 'phuket', patterns: ['ภูเก็ต', 'phuket', 'patong'] },
  { key: 'rayong', patterns: ['ระยอง', 'rayong', 'maptaphut', 'มาบตาพุด'] },
  { key: 'nonthaburi', patterns: ['นนทบุรี', 'nonthaburi', 'nontaburi'] },
  { key: 'other', patterns: [] },
];

const AREA_LABELS = {
  sukhumvit: 'Sukhumvit',
  thonglor: 'Thonglor / Ekkamai',
  silom: 'Silom / Sathorn',
  ratchada: 'Ratchada',
  ladprao: 'Ladprao',
  rama2: 'Rama 2',
  rama9: 'Rama 9',
  bangna: 'Bangna / Srinakarin',
  bangkapi: 'Bangkapi',
  chatuchak: 'Chatuchak',
  pattaya: 'Pattaya',
  chiangmai: 'Chiang Mai',
  phuket: 'Phuket',
  rayong: 'Rayong',
  nonthaburi: 'Nonthaburi',
  other: 'Other areas',
};

function classifyArea(listing) {
  const text = `${listing.location || ''} ${listing.city || ''} ${listing.description || ''}`.toLowerCase();
  for (const area of BANGKOK_AREAS) {
    if (area.key === 'other') continue;
    if (area.patterns.some((p) => text.includes(p.toLowerCase()))) {
      return area.key;
    }
  }
  return 'other';
}

function VibeMap({ listings, t }) {
  const areaData = useMemo(() => {
    const counts = {};
    for (const listing of listings) {
      const area = classifyArea(listing);
      counts[area] = (counts[area] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        label: AREA_LABELS[key] || key,
        count,
        percentage: Math.round((count / Math.max(listings.length, 1)) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .filter((a) => a.count > 0);
  }, [listings]);

  const maxCount = areaData[0]?.count || 1;

  if (areaData.length === 0) return null;

  return (
    <section className="vibe-map">
      <div className="vibe-header">
        <span className="section-kicker">Area activity</span>
        <h2>Where the vibes are</h2>
        <p className="vibe-subtitle">
          Live distribution of massage and spa listings by area. Bigger bars mean more active listings right now.
        </p>
      </div>

      <div className="vibe-grid">
        {areaData.slice(0, 12).map((area) => (
          <div key={area.key} className="vibe-bar-row">
            <div className="vibe-bar-label">
              <span className="vibe-area-name">{area.label}</span>
              <span className="vibe-area-count">{area.count}</span>
            </div>
            <div className="vibe-bar-track">
              <div
                className="vibe-bar-fill"
                style={{ width: `${Math.max((area.count / maxCount) * 100, 4)}%` }}
              />
            </div>
            <span className="vibe-area-pct">{area.percentage}%</span>
          </div>
        ))}
      </div>

      <div className="vibe-footer">
        <span>{listings.length} listings across {areaData.length} areas</span>
      </div>
    </section>
  );
}

export default VibeMap;
