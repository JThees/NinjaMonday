/**
 * Examine ticket #1266 for Service checkbox field
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

console.log('Examining ticket #1266 for Service checkbox field...\n');

const tickets = await ninjaClient.getAllTickets([2]);
const ticket = tickets.find(t => t.id === 1266);

if (!ticket) {
  console.log('❌ Ticket #1266 not found');
  process.exit(1);
}

console.log('=== TICKET #1266 COMPLETE STRUCTURE ===\n');
console.log(JSON.stringify(ticket, null, 2));

console.log('\n\n=== SEARCHING FOR SERVICE FIELD ===\n');

// Check all top-level fields
console.log('Top-level fields:');
for (const key of Object.keys(ticket)) {
  const value = ticket[key];
  const keyLower = key.toLowerCase();

  if (keyLower.includes('service')) {
    console.log(`  ✅ FOUND: ${key} = ${JSON.stringify(value)}`);
  } else {
    console.log(`  ${key}: ${typeof value}`);
  }
}

console.log('\n\nAttribute Values:');
if (ticket.attributeValues && ticket.attributeValues.length > 0) {
  ticket.attributeValues.forEach(attr => {
    console.log(`  Attribute ID ${attr.attributeId}: ${JSON.stringify(attr.value)}`);
  });
} else {
  console.log('  No attributes');
}

console.log('\n\n=== ALL UNIQUE ATTRIBUTE IDs ACROSS ALL TICKETS ===\n');
const allAttrIds = new Set();
tickets.forEach(t => {
  if (t.attributeValues) {
    t.attributeValues.forEach(attr => allAttrIds.add(attr.attributeId));
  }
});
console.log('Unique attribute IDs:', Array.from(allAttrIds).sort((a, b) => a - b));

console.log();
