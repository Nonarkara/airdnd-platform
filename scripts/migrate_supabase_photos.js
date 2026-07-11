import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migratePhotos() {
  console.log('Starting migration...');
  
  const { data: listings, error } = await supabase
    .from('companions')
    .select('id, image_url, photo_urls');
    
  if (error) {
    console.error('Error fetching listings:', error);
    process.exit(1);
  }
  
  let updatedCount = 0;
  for (const listing of listings) {
    let needsUpdate = false;
    const updates = {};
    
    if (listing.image_url && listing.image_url.includes('/photos/')) {
      updates.image_url = listing.image_url.replace('/photos/', '/images/');
      needsUpdate = true;
    }
    
    if (Array.isArray(listing.photo_urls)) {
      const newUrls = listing.photo_urls.map(url => {
        if (typeof url === 'string' && url.includes('/photos/')) {
          return url.replace('/photos/', '/images/');
        }
        return url;
      });
      
      if (JSON.stringify(newUrls) !== JSON.stringify(listing.photo_urls)) {
        updates.photo_urls = newUrls;
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      console.log(`Updating listing ${listing.id}`);
      const { error: updateError } = await supabase
        .from('companions')
        .update(updates)
        .eq('id', listing.id);
        
      if (updateError) {
        console.error(`Error updating listing ${listing.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`Migration complete. Updated ${updatedCount} listings.`);
}

migratePhotos().catch(console.error);
