import fs from 'fs';
import path from 'path';

// This is a placeholder/mock of real infrastructure data for Thailand
// In a real scenario, this would fetch from municipal zoning datasets or transit API.
const infrastructureData = {
  meta: {
    lastUpdated: new Date().toISOString(),
    source: "Simulated transit corridors and zoning data",
    description: "Public works and infrastructure context for analyzing urban density."
  },
  transitCorridors: [
    {
      line: "BTS Sukhumvit",
      color: "#00b259",
      stations: [
        { name: "Asok", lat: 13.7367, lng: 100.5604 },
        { name: "Phrom Phong", lat: 13.7303, lng: 100.5698 },
        { name: "Thong Lo", lat: 13.7242, lng: 100.5779 },
        { name: "Ekkamai", lat: 13.7196, lng: 100.5852 },
        { name: "Phra Khanong", lat: 13.7153, lng: 100.5915 },
        { name: "On Nut", lat: 13.7058, lng: 100.6010 }
      ]
    },
    {
      line: "MRT Blue Line",
      color: "#1c3c95",
      stations: [
        { name: "Rama 9", lat: 13.7570, lng: 100.5650 },
        { name: "Huai Khwang", lat: 13.7770, lng: 100.5730 },
        { name: "Sutthisan", lat: 13.7890, lng: 100.5740 },
        { name: "Ratchadaphisek", lat: 13.7990, lng: 100.5740 },
        { name: "Lat Phrao", lat: 13.8050, lng: 100.5730 }
      ]
    }
  ],
  zoningDistricts: [
    { name: "Ratchada Corridor", type: "Commercial High-Density", code: "C-4" },
    { name: "Sukhumvit Core", type: "Commercial High-Density", code: "C-5" },
    { name: "Lat Phrao", type: "Medium-Density Residential", code: "Y-4" }
  ]
};

const outputPath = path.join(process.cwd(), 'public', 'data', 'infrastructure.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(infrastructureData, null, 2));

console.log(`Infrastructure data written to ${outputPath}`);
