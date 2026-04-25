
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseKey = 'sb_secret_pRiy7j_zMJUtg9RT4UqhFA_SDYU4OuH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepAnalyze() {
  const { data: listings, error } = await supabase.from('companions').select('*');
  if (error) return console.error(error);

  // 1. Time of day analysis (Cheapest)
  // Look for "Pro", "Promotion", "ก่อน" (before), "ช่วง" (during)
  const proListings = listings.filter(l => 
    l.description?.toLowerCase().includes('pro') || 
    l.description?.includes('โปร') ||
    l.priceLabel?.toLowerCase().includes('pro')
  );
  
  const morningPros = proListings.filter(l => /10|11|12|13|14|เช้า|บ่าย/.test(l.description || ''));
  const latePros = proListings.filter(l => /after|20|21|22|23|00|ดึก/.test(l.description || ''));

  console.log('--- TIME ANALYSIS ---');
  console.log(`Listings with promotions: ${proListings.length}`);
  console.log(`Morning/Early Afternoon promos found: ${morningPros.length}`);
  console.log(`Night/Late night promos found: ${latePros.length}`);

  // 2. concentration areas (Neighborhoods)
  // Most cities are Bangkok, let's look at the location field more closely
  const locations = {};
  listings.forEach(l => {
    const loc = l.city || 'Bangkok';
    locations[loc] = (locations[loc] || 0) + 1;
  });
  const sortedLocations = Object.entries(locations).sort((a,b) => b[1] - a[1]);
  console.log('--- CONCENTRATION ---');
  console.log(sortedLocations.slice(0, 5));

  // 3. Nickname Themes
  const names = listings.map(l => l.name).filter(Boolean);
  const luxuryThemes = names.filter(n => /Chanel|Dior|Brand|Luxury|Hi-end/i.test(n));
  const flowerThemes = names.filter(n => /Lotus|Rose|茉莉|ดอกไม้|แก้ว/.test(n));
  const uniqueOnes = names.filter(n => n.length > 20);

  console.log('--- NICKNAMES ---');
  console.log(`Luxury themes: ${luxuryThemes.length} (e.g., ${luxuryThemes.slice(0, 3).join(', ')})`);
  console.log(`Flower themes: ${flowerThemes.length} (e.g., ${flowerThemes.slice(0, 3).join(', ')})`);
  console.log(`Unique/Long titles: ${uniqueOnes.slice(0, 3).join(', ')}`);
}

deepAnalyze();
