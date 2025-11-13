/**
 * Find the Ninja Ticket ID column in Monday.com
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { MondayClient } from './monday-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const mondayClient = new MondayClient(process.env.MONDAY_API_TOKEN);

console.log('🔍 Finding Ninja Ticket ID column in Monday.com Tickets board\n');
console.log('='.repeat(80));

const columns = await mondayClient.getBoardColumns(process.env.MONDAY_TICKETS_BOARD_ID);

console.log('\nAll columns:');
columns.forEach(col => {
  console.log(`  [${col.id}] ${col.title} (${col.type})`);
});

console.log('\n' + '='.repeat(80));

// Look for Ninja Ticket ID
const ninjaTicketCol = columns.find(col =>
  col.title.toLowerCase().includes('ninja') && col.title.toLowerCase().includes('ticket')
);

if (ninjaTicketCol) {
  console.log('\n✅ Found Ninja Ticket ID column:');
  console.log(`   ID: ${ninjaTicketCol.id}`);
  console.log(`   Title: ${ninjaTicketCol.title}`);
  console.log(`   Type: ${ninjaTicketCol.type}`);
  console.log('\n📝 Update the following files with this new ID:');
  console.log('   - config/field-mappings.json');
  console.log('   - src/sync.js');
  console.log('   - src/sync-update.js');
  console.log('   - src/sync-test.js');
  console.log('   - src/sync-dry-run.js');
} else {
  console.log('\n❌ Ninja Ticket ID column not found');
  console.log('\nColumns containing "ticket", "ninja", or "id":');
  columns.filter(col => {
    const title = col.title.toLowerCase();
    return title.includes('ticket') || title.includes('ninja') || title.includes('id');
  }).forEach(col => {
    console.log(`   - ${col.title} (${col.id}) - ${col.type}`);
  });
}

console.log();
