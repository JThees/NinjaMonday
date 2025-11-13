/**
 * List all unique statuses from NinjaRMM tickets and Monday.com board
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

console.log('\n📊 STATUS MAPPING REFERENCE\n');
console.log('='.repeat(80));

// Get all tickets
const tickets = await ninjaClient.getAllTickets([2]);
console.log(`Fetched ${tickets.length} tickets from NinjaRMM\n`);

// Extract unique statuses
const statusCounts = new Map();
for (const ticket of tickets) {
  const status = ticket.status?.displayName || 'Unknown';
  statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
}

// Sort by count (most common first)
const sortedStatuses = Array.from(statusCounts.entries())
  .sort((a, b) => b[1] - a[1]);

console.log('NINJARMM STATUSES (from 50 tickets):');
console.log('-'.repeat(80));
sortedStatuses.forEach(([status, count]) => {
  console.log(`  "${status}".padEnd(30) - ${count} ticket(s)`);
});

console.log('\n\nMONDAY.COM STATUSES (available in your board):');
console.log('-'.repeat(80));
console.log('  "Working on it"');
console.log('  "Done"');
console.log('  "Stuck"');
console.log('  "Working BUT"');

console.log('\n\n' + '='.repeat(80));
console.log('INSTRUCTIONS:');
console.log('='.repeat(80));
console.log('Create a mapping from NinjaRMM statuses → Monday statuses.');
console.log('Example format:');
console.log('');
console.log('{');
console.log('  "Closed": "Done",');
console.log('  "Pending Vendor": "Working on it",');
console.log('  "Paused": "Working on it",');
console.log('  // ... etc');
console.log('}');
console.log('');
console.log('='.repeat(80));
console.log('');
