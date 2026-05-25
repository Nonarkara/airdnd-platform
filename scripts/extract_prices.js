import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function extractPrice(description) {
  if (!description) return null;
  
  // Try to find explicit mentions of price, starting price, or numbers followed by currency
  const matches = description.match(/(?:ราคา|เริ่มต้น|จ่าย|ค่าตัว)?\s*(\d{1,2},\d{3}|\d{3,4})\s*(?:บาท|baht|thb|b|฿|-)/i);
  if (matches && matches[1]) {
    const value = parseInt(matches[1].replace(/,/g, ''), 10);
    // Sanity check: prices usually between 200 and 50000 THB
    if (value >= 200 && value <= 50000) {
      return value;
    }
  }
  
  // Fallback for just a number next to a currency keyword
  const fallbackMatch = description.match(/(\d{1,2},\d{3}|\d{3,4})\s*(?:บาท|baht|thb|b)/i);
  if (fallbackMatch && fallbackMatch[1]) {
      const value = parseInt(fallbackMatch[1].replace(/,/g, ''), 10);
      if (value >= 200 && value <= 50000) {
        return value;
      }
  }
  return null;
}

async function run() {
  console.log('Loading listings from database...');
  const { data: listings, error } = await supabase.from('companions').select('id, description, price');
  
  if (error) {
    console.error('Failed to fetch from Supabase:', error);
    process.exit(1);
  }
  
  let updatedCount = 0;
  
  for (const listing of listings) {
    const isMissingPrice = !listing.price || 
                           listing.price === 'Rate on request' || 
                           listing.price.toLowerCase() === 'none' ||
                           listing.price.toLowerCase() === 'tbd';

    if (isMissingPrice && listing.description) {
      const extractedValue = extractPrice(listing.description);
      if (extractedValue) {
        console.log(`[ID: ${listing.id}] Extracted: ${extractedValue} THB from description`);
        
        const { error: updateError } = await supabase
          .from('companions')
          .update({
            price: `${extractedValue} THB`
          })
          .eq('id', listing.id);
          
        if (updateError) {
          console.error(`Failed to update ID ${listing.id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }
  }
  
  console.log(`\nFinished updating prices. Total updated: ${updatedCount}`);
}

run();
