
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseKey = 'sb_secret_pRiy7j_zMJUtg9RT4UqhFA_SDYU4OuH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeData() {
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    return;
  }

  console.log(`Total listings: ${data.length}`);
  if (data.length > 0) {
    console.log(`Latest listing created at: ${data[0].created_at}`);
  }

  // 1. Cheapest time of day
  // Analysis logic: parse 'hours' field or 'created_at' if it's our only proxy.
  // Actually, many massage place messages have hours. Let's look at mentions of "Promotion" or price variations.
  
  // 2. Concentration areas
  const cityCounts = {};
  data.forEach(item => {
    const city = item.city || 'Bangkok';
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });
  console.log('City concentrations:', cityCounts);

  // 3. Unique nicknames
  const nicknames = data.map(item => item.name).filter(Boolean);
  const uniqueNicknames = [...new Set(nicknames)].slice(0, 20);
  console.log('Sample Nicknames:', uniqueNicknames);

  // 4. Cheapest Avg Price
  const prices = data.map(item => {
    const price = parseFloat(item.priceLabel?.replace(/[^\d.]/g, ''));
    return isFinite(price) ? price : null;
  }).filter(p => p !== null);
  
  if (prices.length > 0) {
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    console.log(`Average listed price: ${avgPrice.toFixed(2)} THB`);
  }
}

analyzeData();
