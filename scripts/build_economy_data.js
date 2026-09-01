import fs from 'fs';
import path from 'path';

// This is a placeholder/mock of real economic data for Thailand provinces
// In a real scenario, this would fetch from NESDC or Ministry of Labour open data portals.
const economyData = {
  meta: {
    lastUpdated: new Date().toISOString(),
    source: "NESDC (Gross Provincial Product) and Ministry of Labour (Minimum Wage) - Simulated",
    description: "Macro-economic indicators by province for contextualizing the grey economy."
  },
  provinces: [
    {
      code: "10",
      name: "Bangkok",
      gppPerCapita: 605000, // THB/year approx
      minimumWage: 363, // THB/day (approx 2024 rates)
      touristArrivals: 22000000 // Annual
    },
    {
      code: "11",
      name: "Samut Prakan",
      gppPerCapita: 420000,
      minimumWage: 363,
      touristArrivals: 2500000
    },
    {
      code: "12",
      name: "Nonthaburi",
      gppPerCapita: 310000,
      minimumWage: 363,
      touristArrivals: 1800000
    },
    {
      code: "13",
      name: "Pathum Thani",
      gppPerCapita: 340000,
      minimumWage: 363,
      touristArrivals: 1500000
    },
    {
      code: "20",
      name: "Chonburi",
      gppPerCapita: 580000,
      minimumWage: 361,
      touristArrivals: 18000000
    },
    {
      code: "50",
      name: "Chiang Mai",
      gppPerCapita: 180000,
      minimumWage: 350,
      touristArrivals: 8000000
    },
    {
      code: "83",
      name: "Phuket",
      gppPerCapita: 390000,
      minimumWage: 370,
      touristArrivals: 14000000
    }
  ]
};

const outputPath = path.join(process.cwd(), 'public', 'data', 'economy.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(economyData, null, 2));

console.log(`Economy data written to ${outputPath}`);
