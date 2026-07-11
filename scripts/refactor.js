import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

function refactorFile(filePath) {
  if (!filePath.match(/\.(js|jsx|css|json)$/)) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  // Exact component names and files
  newContent = newContent.replace(/CompanionCard/g, 'ListingCard');
  newContent = newContent.replace(/CompanionGrid/g, 'ListingGrid');
  newContent = newContent.replace(/CompanionModal/g, 'ListingModal');
  
  // Variables and references
  newContent = newContent.replace(/companion/g, 'listing');
  newContent = newContent.replace(/Companion/g, 'Listing');
  newContent = newContent.replace(/COMPANION/g, 'LISTING');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Refactored: ${filePath}`);
  }
}

walk(srcDir, refactorFile);
console.log('Refactoring complete.');
