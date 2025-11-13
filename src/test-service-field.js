/**
 * Test script to verify Service checkbox field is working
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { getServiceCallValue } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const ninjaClient = new NinjaClient(
  process.env.NINJA_CLIENT_ID,
  process.env.NINJA_CLIENT_SECRET
);

console.log('🔍 Testing Service checkbox field (Attribute ID 80)\n');
console.log('='.repeat(80));

// Fetch ticket #1266
const tickets = await ninjaClient.getAllTickets([2]);
const ticket = tickets.find(t => t.id === 1266);

if (!ticket) {
  console.log('❌ Ticket #1266 not found');
  process.exit(1);
}

console.log('\n📋 Ticket #1266 Details:');
console.log(`  Summary: ${ticket.summary}`);
console.log(`  Device: ${ticket.device || 'N/A'}`);
console.log(`  Status: ${ticket.status?.displayName || 'N/A'}`);

console.log('\n📊 All Attributes:');
if (ticket.attributeValues && ticket.attributeValues.length > 0) {
  ticket.attributeValues.forEach(attr => {
    let name = 'Unknown';
    if (attr.attributeId === 54) name = 'Kiosk ID';
    if (attr.attributeId === 10) name = 'County';
    if (attr.attributeId === 80) name = 'Service (checkbox)';

    console.log(`  [${attr.attributeId}] ${name}: ${JSON.stringify(attr.value)}`);
  });
} else {
  console.log('  No attributes found');
}

// Check for Service checkbox specifically
const serviceAttr = ticket.attributeValues?.find(a => a.attributeId === 80);
console.log('\n✅ Service Checkbox (Attribute 80):');
if (serviceAttr) {
  console.log(`  Raw value: ${JSON.stringify(serviceAttr.value)}`);
  console.log(`  Type: ${typeof serviceAttr.value}`);

  // Test the mapping function
  const mondayLabel = getServiceCallValue(ticket.attributeValues, 80);
  console.log(`  Monday.com label: ${mondayLabel}`);
  console.log('\n✅ SERVICE FIELD IS WORKING!');
} else {
  console.log(`  ⚠️ NOT FOUND - Attribute 80 is not present in this ticket`);
  console.log(`\n  This could mean:`);
  console.log(`  1. The checkbox hasn't been checked/unchecked yet`);
  console.log(`  2. The field needs to be saved in NinjaRMM`);
  console.log(`  3. There's a delay in the API updating`);
  console.log(`\n  Please:`);
  console.log(`  - Open ticket #1266 in NinjaRMM`);
  console.log(`  - Check the "Service" checkbox`);
  console.log(`  - Save the ticket`);
  console.log(`  - Wait 30 seconds and run this script again`);
}

console.log('\n' + '='.repeat(80));
console.log();
