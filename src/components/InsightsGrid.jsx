
import './InsightsGrid.css';

function InsightsGrid({ t }) {
  const insights = [
    {
      title: 'Best Value Time',
      description: 'Late night (20:00–00:00) sees +35% more "Promotion" mentions than mornings.',
      color: 'blue'
    },
    {
      title: 'Top Sanctuary Hub',
      description: 'Bangkok remains king, but Nonthaburi is the fastest growing cluster this month.',
      color: 'gold'
    },
    {
      title: 'Most Iconic Brand',
      description: '"CHANEL MASSAGE" has been the most spotted legacy shop name this week.',
      color: 'purple'
    },
    {
      title: 'Staff Nicknames',
      description: 'Flower names (Lotus, Rose) are falling; Luxury themes are the new meta.',
      color: 'pink'
    }
  ];

  return (
    <div className="insights-grid">
      {insights.map((item, i) => (
        <div key={i} className={`insight-card insight-${item.color}`}>
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
