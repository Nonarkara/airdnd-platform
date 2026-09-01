import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDomainPath = path.join(__dirname, '../domain.config.json');

export function loadDomainConfig(customPath) {
  const targetPath = customPath || process.env.DOMAIN_CONFIG_PATH || defaultDomainPath;
  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[DomainLoader] Failed to parse ${targetPath}: ${err.message}. Falling back to default.`);
    }
  }
  
  // Fallback default config (Wellness)
  const wellnessPath = path.join(__dirname, '../domains/wellness.json');
  if (fs.existsSync(wellnessPath)) {
    return JSON.parse(fs.readFileSync(wellnessPath, 'utf-8'));
  }

  return {
    domain_id: 'default',
    name: 'Community Intelligence Directory',
    taxonomy: {
      primary_entity: 'Listing',
      secondary_entity: 'Provider',
      unit_of_service: 'Service',
      currency: 'THB',
      service_categories: ['Standard']
    },
    database: {
      table_name: 'companions',
      message_archive_table: 'channel_messages'
    }
  };
}

export default loadDomainConfig;
