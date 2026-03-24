import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readSnapshotListings, writeSnapshotListings } from './listing_pipeline.js';
import { isLocalPhotoUrl, uploadLocalPhotoToStorage } from './photo_storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

async function repairSnapshotPhotos() {
  const snapshot = readSnapshotListings();
  const replacements = new Map();
  const nextSnapshot = [];

  for (const listing of snapshot) {
    if (!isLocalPhotoUrl(listing.imageUrl)) {
      nextSnapshot.push(listing);
      continue;
    }

    let publicUrl = replacements.get(listing.imageUrl);
    if (!publicUrl) {
      publicUrl = await uploadLocalPhotoToStorage(listing.imageUrl);
      if (publicUrl) {
        replacements.set(listing.imageUrl, publicUrl);
        console.log(`Uploaded ${listing.imageUrl} -> ${publicUrl}`);
      } else {
        console.warn(`Could not repair ${listing.imageUrl}; leaving it unchanged.`);
      }
    }

    nextSnapshot.push({
      ...listing,
      imageUrl: publicUrl || listing.imageUrl,
    });
  }

  if (replacements.size > 0) {
    writeSnapshotListings(nextSnapshot);
  }

  return replacements;
}

async function repairDatabasePhotos(replacements) {
  if (!supabase || replacements.size === 0) {
    return;
  }

  for (const [oldUrl, newUrl] of replacements.entries()) {
    const { error } = await supabase
      .from('companions')
      .update({ image_url: newUrl })
      .eq('image_url', oldUrl);

    if (error) {
      console.warn(`Failed to update database rows for ${oldUrl}:`, error.message);
    }
  }
}

async function main() {
  const replacements = await repairSnapshotPhotos();
  await repairDatabasePhotos(replacements);
  console.log(`Photo repair complete. Updated ${replacements.size} unique photo URL(s).`);
}

main();
