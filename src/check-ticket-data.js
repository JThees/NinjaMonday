/**
 * Display ticket IDs and kiosk ID field values from NinjaRMM
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { getAttributeValue } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const ninjaClient = new NinjaClient(
  process.env.NINJA_CLIENT_ID,
  process.env.NINJA_CLIENT_SECRET
);

console.log('\n📋 CHECKING NINJA TICKET DATA\n');
console.log('Fetching tickets from "All tickets" board (ID: 2)...\n');

const tickets = await ninjaClient.getAllTickets([2]);

console.log(`Found ${tickets.length} tickets\n`);
console.log('='.repeat(100));
console.log('Ticket ID | Kiosk ID (Attr 54) | County (Attr 10) | Status | Summary');
console.log('='.repeat(100));

for (const ticket of tickets) {
  const kioskId = getAttributeValue(ticket.attributeValues, 54);
  const county = getAttributeValue(ticket.attributeValues, 10);
  const status = ticket.status?.displayName || 'N/A';
  const summary = ticket.summary?.substring(0, 40) || 'N/A';

  console.log(
    `#${String(ticket.id).padEnd(8)} | ` +
    `${(kioskId || 'NULL').padEnd(18)} | ` +
    `${(county || 'NULL').padEnd(16)} | ` +
    `${status.padEnd(20).substring(0, 20)} | ` +
    `${summary}`
  );
}

console.log('='.repeat(100));
console.log(`\nTotal: ${tickets.length} tickets`);

// Count how many have kiosk IDs
const withKioskId = tickets.filter(t => getAttributeValue(t.attributeValues, 54)).length;
const withoutKioskId = tickets.length - withKioskId;

console.log(`With Kiosk ID: ${withKioskId}`);
console.log(`Without Kiosk ID: ${withoutKioskId}`);

// Show the raw attributeValues for a few tickets to debug
console.log('\n\n🔍 RAW DATA SAMPLE (first 3 tickets):');
console.log('='.repeat(100));
for (let i = 0; i < Math.min(3, tickets.length); i++) {
  const ticket = tickets[i];
  console.log(`\nTicket #${ticket.id}:`);
  console.log('attributeValues:', JSON.stringify(ticket.attributeValues, null, 2));
}
