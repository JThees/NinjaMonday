/**
 * Inspect specific tickets to see raw data
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const ninjaClient = new NinjaClient(
  process.env.NINJA_CLIENT_ID,
  process.env.NINJA_CLIENT_SECRET
);

// Ticket IDs to inspect
const ticketIds = [1264, 1263, 1262];

console.log('\n📋 RAW TICKET DATA INSPECTION\n');
console.log('='.repeat(80));

const allTickets = await ninjaClient.getAllTickets([2]);

for (const ticketId of ticketIds) {
  const ticket = allTickets.find(t => t.id === ticketId);

  if (!ticket) {
    console.log(`\n❌ Ticket #${ticketId} NOT FOUND`);
    continue;
  }

  console.log(`\n🎫 TICKET #${ticketId}`);
  console.log('-'.repeat(80));
  console.log('Summary:', ticket.summary || 'N/A');
  console.log('Device:', ticket.device || 'N/A');
  console.log('Location:', ticket.location || 'N/A');
  console.log('Status:', ticket.status?.displayName || 'N/A');
  console.log('Tags:', ticket.tags?.join(', ') || 'None');
  console.log('Create Time:', new Date(ticket.createTime * 1000).toISOString());
  console.log('\nAttribute Values:');
  if (ticket.attributeValues && ticket.attributeValues.length > 0) {
    for (const attr of ticket.attributeValues) {
      console.log(`  - Attribute ID ${attr.attributeId}: ${attr.value}`);
    }
  } else {
    console.log('  (No attribute values)');
  }

  console.log('\nFull Raw Data:');
  console.log(JSON.stringify(ticket, null, 2));
}

console.log('\n' + '='.repeat(80));
