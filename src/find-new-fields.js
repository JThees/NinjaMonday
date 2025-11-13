/**
 * Find the Service Call column in Monday and Service checkbox in NinjaRMM
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const ninjaClient = new NinjaClient(
  process.env.NINJA_CLIENT_ID,
  process.env.NINJA_CLIENT_SECRET
);

const mondayClient = new MondayClient(
  process.env.MONDAY_API_TOKEN
);

console.log('\n🔍 FINDING NEW FIELDS\n');
console.log('='.repeat(80));

// Find Monday.com "Service call" column
console.log('\n1️⃣  Monday.com Tickets Board Columns:');
console.log('-'.repeat(80));

const columns = await mondayClient.getBoardColumns(process.env.MONDAY_TICKETS_BOARD_ID);

console.log('\nAll columns:');
for (const col of columns) {
  console.log(`  [${col.id}] ${col.title.padEnd(25)} (${col.type})`);
}

const serviceCallColumn = columns.find(col =>
  col.title.toLowerCase().includes('service') && col.title.toLowerCase().includes('call')
);

if (serviceCallColumn) {
  console.log('\n✅ Found "Service call" column:');
  console.log(`   ID: ${serviceCallColumn.id}`);
  console.log(`   Title: ${serviceCallColumn.title}`);
  console.log(`   Type: ${serviceCallColumn.type}`);

  if (serviceCallColumn.settings_str) {
    console.log(`   Settings: ${serviceCallColumn.settings_str}`);
  }
} else {
  console.log('\n❌ "Service call" column not found. Columns with "service":');
  columns.filter(col => col.title.toLowerCase().includes('service')).forEach(col => {
    console.log(`   - ${col.title} (${col.id})`);
  });
}

// Check NinjaRMM ticket structure
console.log('\n\n2️⃣  NinjaRMM Ticket Structure (Recent Ticket):');
console.log('-'.repeat(80));

const tickets = await ninjaClient.getAllTickets([2]);
const recentTicket = tickets.find(t => t.createTime >= new Date('2025-07-01').getTime() / 1000);

if (recentTicket) {
  console.log('\nSample ticket fields:');
  console.log(JSON.stringify(recentTicket, null, 2));

  console.log('\n\nLooking for "Service" related fields...');
  for (const [key, value] of Object.entries(recentTicket)) {
    if (key.toLowerCase().includes('service') ||
        (typeof value === 'string' && value.toLowerCase().includes('service'))) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  if (recentTicket.attributeValues && recentTicket.attributeValues.length > 0) {
    console.log('\n\nAttribute Values:');
    for (const attr of recentTicket.attributeValues) {
      console.log(`  Attribute ID ${attr.attributeId}: ${JSON.stringify(attr)}`);
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log();
