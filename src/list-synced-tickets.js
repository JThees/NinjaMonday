/**
 * List all tickets that were synced (or attempted to sync)
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CONFIG = {
  NINJA_BOARD_IDS: [2],
  MIN_CREATE_DATE: new Date('2025-08-01T00:00:00Z')
};

console.log('\n📋 SYNCED TICKETS LIST\n');
console.log('='.repeat(80));

const ninjaClient = new NinjaClient(
  process.env.NINJA_CLIENT_ID,
  process.env.NINJA_CLIENT_SECRET
);

// Fetch all tickets
const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);

// Filter by date
const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000;
const recentTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);

console.log(`Found ${recentTickets.length} tickets created on or after ${CONFIG.MIN_CREATE_DATE.toISOString().split('T')[0]}\n`);

// Sort by ticket ID descending (newest first)
recentTickets.sort((a, b) => b.id - a.id);

console.log('Ticket #  | Device/Kiosk         | Summary');
console.log('-'.repeat(80));

for (const ticket of recentTickets) {
  const ticketId = String(ticket.id).padEnd(8);
  const device = (ticket.device || 'N/A').padEnd(20);
  const summary = (ticket.summary || 'N/A').substring(0, 40);

  console.log(`${ticketId} | ${device} | ${summary}`);
}

console.log('\n' + '='.repeat(80));
console.log(`Total: ${recentTickets.length} tickets\n`);
