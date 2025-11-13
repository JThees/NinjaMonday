/**
 * Export all tickets to a readable text file for review
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';
import {
  toShortKioskId,
  unixToDate,
  buildKioskLookupMap
} from './utils.js';
import { writeFile } from 'fs/promises';

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

console.log('Fetching data...\n');

// Fetch kiosks for enrichment
const kiosks = await mondayClient.getBoardItems(process.env.MONDAY_KIOSKS_BOARD_ID);
const kioskLookup = buildKioskLookupMap(kiosks);

// Fetch tickets
const tickets = await ninjaClient.getAllTickets([2]);

console.log(`Processing ${tickets.length} tickets...\n`);

// Build output
let output = [];
output.push('='.repeat(100));
output.push('NINJARMM TICKETS - FULL EXPORT FOR REVIEW');
output.push('='.repeat(100));
output.push('');
output.push(`Total Tickets: ${tickets.length}`);
output.push(`Export Date: ${new Date().toISOString()}`);
output.push(`Source: NinjaRMM "All tickets" board (ID: 2)`);
output.push('');
output.push('='.repeat(100));
output.push('');

let ticketsWithKiosk = 0;
let ticketsWithoutKiosk = 0;

for (let i = 0; i < tickets.length; i++) {
  const ticket = tickets[i];

  // Extract data
  const fullKioskId = ticket.device || null;
  const shortKioskId = fullKioskId ? toShortKioskId(fullKioskId) : null;
  const date = unixToDate(ticket.createTime);
  const tags = ticket.tags || [];
  const status = ticket.status?.displayName || 'Unknown';

  // Enrich with kiosk data
  let county = null;
  let location = ticket.location || null;

  if (shortKioskId) {
    ticketsWithKiosk++;
    const kioskData = kioskLookup.get(shortKioskId);
    if (kioskData) {
      county = kioskData.county;
      if (kioskData.location) location = kioskData.location;
    }
  } else {
    ticketsWithoutKiosk++;
  }

  // Format ticket
  output.push(`TICKET #${ticket.id} (${i + 1} of ${tickets.length})`);
  output.push('-'.repeat(100));
  output.push(`Summary:         ${ticket.summary || 'N/A'}`);
  output.push(`Status:          ${status}`);
  output.push(`Created:         ${date || 'N/A'}`);
  output.push(`Device:          ${fullKioskId || 'N/A'}`);
  output.push(`Kiosk ID:        ${shortKioskId || 'N/A'}`);
  output.push(`County:          ${county || 'N/A'}`);
  output.push(`Location:        ${location || 'N/A'}`);
  output.push(`Tags:            ${tags.length > 0 ? tags.join(', ') : 'None'}`);
  output.push(`Requester:       ${ticket.requester || 'N/A'}`);
  output.push(`Assigned To:     ${ticket.assignedAppUser || 'N/A'}`);
  output.push(`Priority:        ${ticket.priority || 'N/A'}`);
  output.push(`Severity:        ${ticket.severity || 'N/A'}`);
  output.push('');
  output.push('Description:');
  output.push(ticket.description?.substring(0, 500) || 'N/A');
  if (ticket.description && ticket.description.length > 500) {
    output.push('... (truncated)');
  }
  output.push('');
  output.push('');
}

output.push('='.repeat(100));
output.push('SUMMARY');
output.push('='.repeat(100));
output.push(`Total tickets:               ${tickets.length}`);
output.push(`Tickets with kiosk ID:       ${ticketsWithKiosk}`);
output.push(`Tickets without kiosk ID:    ${ticketsWithoutKiosk}`);
output.push('');
output.push('Tickets with kiosk ID will have county/location enriched from ILH Kiosks board.');
output.push('Tickets without kiosk ID will use the location field from NinjaRMM (if available).');
output.push('');
output.push('='.repeat(100));

const outputText = output.join('\n');
const outputPath = join(__dirname, '..', 'tickets-export.txt');

await writeFile(outputPath, outputText, 'utf8');

console.log(`✅ Export complete!`);
console.log(`📄 File saved to: tickets-export.txt`);
console.log(`\nSummary:`);
console.log(`  Total tickets: ${tickets.length}`);
console.log(`  With kiosk ID: ${ticketsWithKiosk}`);
console.log(`  Without kiosk ID: ${ticketsWithoutKiosk}`);
