/**
 * Check Monday.com Status column settings
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MondayClient } from './monday-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const mondayClient = new MondayClient(process.env.MONDAY_API_TOKEN);

console.log('\n📊 CHECKING MONDAY.COM STATUS COLUMN\n');

const columns = await mondayClient.getBoardColumns(process.env.MONDAY_TICKETS_BOARD_ID);

const statusColumn = columns.find(col => col.id === 'status');

if (statusColumn) {
  console.log('Status Column Found:');
  console.log(`  ID: ${statusColumn.id}`);
  console.log(`  Title: ${statusColumn.title}`);
  console.log(`  Type: ${statusColumn.type}`);
  console.log('\n  Settings:');

  const settings = JSON.parse(statusColumn.settings_str);
  console.log(JSON.stringify(settings, null, 2));

  if (settings.labels) {
    console.log('\n  Available Status Labels:');
    Object.entries(settings.labels).forEach(([key, value]) => {
      console.log(`    ${key}: "${value}"`);
    });
  }
} else {
  console.log('❌ Status column not found');
}
