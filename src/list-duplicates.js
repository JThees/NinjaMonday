/**
 * List duplicate items in Monday.com board
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MondayClient } from './monday-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const mondayClient = new MondayClient(process.env.MONDAY_API_TOKEN);

console.log('Fetching all items from Monday.com Tickets board...\n');

const items = await mondayClient.getBoardItems(process.env.MONDAY_TICKETS_BOARD_ID);

console.log(`Total items in board: ${items.length}\n`);

// Filter to recent items (likely test items)
const recentItems = items.filter(item => {
  const itemNum = parseInt(item.name, 10);
  return !isNaN(itemNum) && itemNum >= 60;
});

console.log('Recent items (60+):');
console.log('='.repeat(80));

const itemsToDelete = [];
const itemsToKeep = [];

recentItems.forEach(item => {
  // Get Ninja Ticket ID
  const ninjaTicketIdCol = item.column_values.find(cv => cv.id === 'text_mkxn628j');
  const ninjaTicketId = ninjaTicketIdCol?.text || null;

  // Get Service Call
  const serviceCallCol = item.column_values.find(cv => cv.id === 'dropdown_mkwznn43');
  const serviceCall = serviceCallCol?.text || 'Not Set';

  const status = ninjaTicketId ? 'KEEP' : 'DELETE';

  console.log(`${status === 'DELETE' ? '❌' : '✅'} Item #${item.name} (Monday ID: ${item.id})`);
  console.log(`   Ninja Ticket ID: ${ninjaTicketId || 'MISSING'}`);
  console.log(`   Service Call: ${serviceCall}`);
  console.log(`   Status: ${status}`);
  console.log();

  if (ninjaTicketId) {
    itemsToKeep.push(item);
  } else {
    itemsToDelete.push(item);
  }
});

console.log('='.repeat(80));
console.log(`\n📊 Summary:`);
console.log(`   ✅ Items to KEEP (have Ninja Ticket ID): ${itemsToKeep.length}`);
console.log(`   ❌ Items to DELETE (missing Ninja Ticket ID): ${itemsToDelete.length}`);

if (itemsToDelete.length > 0) {
  console.log(`\n⚠️  You should delete these ${itemsToDelete.length} items from Monday.com:`);
  itemsToDelete.forEach(item => {
    console.log(`   - Item #${item.name} (ID: ${item.id})`);
  });
  console.log('\nTo delete them, go to Monday.com and manually delete these items.');
}

console.log();
