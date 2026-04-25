
import './InsightsGrid.css';

function InsightsGrid({ t }) {
  const insights = [
    {
      emoji: '🌙',
      title: 'Best Value Time',
      description: 'Late night (20:00–00:00) sees +35% more "Promotion" mentions than mornings.',
      color: 'blue'
    },
    {
      emoji: '📍',
      title: 'Top Sanctuary Hub',
      description: 'Bangkok remains king, but Nonthaburi is the fastest growing cluster this month.',
      color: 'gold'
    },
    {
      emoji: '👑',
      title: 'Most Iconic Brand',
      description: '"CHANEL MASSAGE" has been the most spotted legacy shop name this week.',
      color: 'purple'
    },
    {
      emoji: '🌸',
      title: 'Staff Nicknames',
      description: 'Flower names (Lotus, Rose) are falling; Luxury themes are the new meta.',
      color: 'pink'
    }
  ];

  return (
    <div className="insights-grid">
      {insights.map((item, i) => (
        <div key={i} className={`insight-card insight-${item.color}`}>
          <span className="insight-emoji">{item.emoji}</span>
          <div className="insight-content">
            <h4 className="insight-title">{item.title}</h4>
            <p className="insight-body">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default InsightsGrid;
