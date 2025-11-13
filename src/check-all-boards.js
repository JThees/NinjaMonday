/**
 * Check which boards return attributeValues
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

console.log('\n📋 CHECKING ALL TICKET BOARDS FOR attributeValues\n');

const boards = await ninjaClient.getTicketBoards();

for (const board of boards) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Board: ${board.name} (ID: ${board.id})`);
  console.log('='.repeat(80));

  try {
    const tickets = await ninjaClient.getTicketsFromBoard(board.id);
    console.log(`Tickets in board: ${tickets.length}`);

    if (tickets.length > 0) {
      const firstTicket = tickets[0];
      console.log(`\nFirst ticket (#${firstTicket.id}):`);
      console.log(`  Has attributeValues: ${firstTicket.attributeValues !== undefined}`);

      if (firstTicket.attributeValues) {
        console.log(`  attributeValues: ${JSON.stringify(firstTicket.attributeValues, null, 2)}`);

        const kioskId = getAttributeValue(firstTicket.attributeValues, 54);
        const county = getAttributeValue(firstTicket.attributeValues, 10);

        console.log(`  Kiosk ID (attr 54): ${kioskId || 'NULL'}`);
        console.log(`  County (attr 10): ${county || 'NULL'}`);
      } else {
        console.log(`  ⚠️  NO attributeValues field in response`);
        console.log(`  Available fields: ${Object.keys(firstTicket).join(', ')}`);
      }

      // Check a few more tickets
      const withAttrs = tickets.filter(t => t.attributeValues !== undefined).length;
      console.log(`\n  Summary: ${withAttrs}/${tickets.length} tickets have attributeValues`);
    } else {
      console.log('  (Empty board)');
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('RECOMMENDATION: Use boards that include attributeValues field');
console.log('='.repeat(80));
