/**
 * Check if tickets have device references and fetch device data
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { toShortKioskId } from './utils.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const ninjaClient = new NinjaClient(
  process.env.NINJA_CLIENT_ID,
  process.env.NINJA_CLIENT_SECRET
);

console.log('\n📋 CHECKING TICKET → DEVICE LINKAGE\n');

// Get tickets from "All tickets" board
const tickets = await ninjaClient.getAllTickets([2]);
console.log(`Fetched ${tickets.length} tickets from "All tickets" board\n`);

// Look at first few tickets to find device reference
console.log('='.repeat(100));
console.log('Analyzing ticket fields for device references...\n');

for (let i = 0; i < Math.min(5, tickets.length); i++) {
  const ticket = tickets[i];
  console.log(`Ticket #${ticket.id}:`);
  console.log(`  Summary: ${ticket.summary?.substring(0, 60)}`);
  console.log(`  All fields: ${Object.keys(ticket).join(', ')}`);

  // Check for device-related fields
  const deviceFields = Object.keys(ticket).filter(key =>
    key.toLowerCase().includes('device') ||
    key.toLowerCase().includes('node') ||
    key.toLowerCase() === 'client' ||
    key.toLowerCase() === 'clientid'
  );

  if (deviceFields.length > 0) {
    console.log(`  Device-related fields found: ${deviceFields.join(', ')}`);
    deviceFields.forEach(field => {
      console.log(`    ${field}: ${ticket[field]}`);
    });
  } else {
    console.log(`  ⚠️  No obvious device reference fields`);
  }

  console.log();
}

console.log('='.repeat(100));

// Now test: fetch a device and show its structure
console.log('\n\nFetching sample device to show structure...\n');

try {
  const token = await ninjaClient.getAccessToken();
  const devicesResponse = await axios.get(
    `${ninjaClient.apiUrl}/devices`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: { pageSize: 3 }
    }
  );

  console.log(`Found ${devicesResponse.data.length} devices\n`);

  for (const device of devicesResponse.data) {
    console.log(`Device ID: ${device.id}`);
    console.log(`  System Name: ${device.systemName}`);
    console.log(`  Short Kiosk ID: ${toShortKioskId(device.systemName)}`);
    console.log(`  Location ID: ${device.locationId}`);
    console.log(`  Organization ID: ${device.organizationId}`);
    console.log();
  }
} catch (error) {
  console.error('Error fetching devices:', error.message);
}

console.log('='.repeat(100));
console.log('\n💡 If tickets have deviceId or similar field, we can fetch device data to get Kiosk ID');
