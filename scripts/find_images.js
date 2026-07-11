import fs from 'fs';
import path from 'path';

const dirsToSearch = ['public/mockups', 'public/images', 'public/photos'];
const allFiles = [];

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else {
      allFiles.push({ name: file, path: fullPath });
    }
  }
}

for (const dir of dirsToSearch) {
  if (fs.existsSync(dir)) walk(dir);
}

const dataPath = 'public/data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let matchesCount = 0;
const replacements = [];

for (const d of data) {
  if (d.imageUrl && d.imageUrl.includes('supabase.co')) {
    const urlParts = d.imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Extract photo ID
    const photoIdMatch = filename.match(/photo(\d+)/) || filename.match(/tg_\d+_(\d+)/);
    const photoId = photoIdMatch ? photoIdMatch[1] : filename.replace('.jpg', '');
    
    const found = allFiles.find(f => f.name.includes(photoId));
    if (found) {
      matchesCount++;
      const relativePath = '/' + path.relative('public', found.path);
      console.log(`Match for ${d.name}: old image = ${d.imageUrl} -> new local path = ${relativePath}`);
      replacements.push({ id: d.id, name: d.name, oldUrl: d.imageUrl, newUrl: relativePath });
    }
  }
}

console.log('Total matched:', matchesCount);
console.log('Replacements count:', replacements.length);
fs.writeFileSync('scripts/replacements.json', JSON.stringify(replacements, null, 2));
