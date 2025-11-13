/**
 * Inspect tags from both NinjaRMM and Monday.com
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CONFIG = {
  NINJA: {
    CLIENT_ID: process.env.NINJA_CLIENT_ID,
    CLIENT_SECRET: process.env.NINJA_CLIENT_SECRET
  },
  MONDAY: {
    API_TOKEN: process.env.MONDAY_API_TOKEN,
    TICKETS_BOARD_ID: process.env.MONDAY_TICKETS_BOARD_ID
  },
  MONDAY_COLUMNS: {
    CORE_ISSUE: 'tag_mkwzqtky'
  },
  NINJA_BOARD_IDS: [2],
  MIN_CREATE_DATE: new Date('2025-08-01T00:00:00Z')
};

console.log('\n📋 TAG MAPPING INSPECTION\n');
console.log('='.repeat(80));

// Initialize clients
const ninjaClient = new NinjaClient(CONFIG.NINJA.CLIENT_ID, CONFIG.NINJA.CLIENT_SECRET);
const mondayClient = new MondayClient(CONFIG.MONDAY.API_TOKEN);

// Step 1: Get Monday.com tag column settings
console.log('\n1️⃣  MONDAY.COM CORE ISSUE TAGS');
console.log('-'.repeat(80));

const columns = await mondayClient.getBoardColumns(CONFIG.MONDAY.TICKETS_BOARD_ID);
const coreIssueColumn = columns.find(col => col.id === CONFIG.MONDAY_COLUMNS.CORE_ISSUE);

if (coreIssueColumn) {
  console.log(`Column: ${coreIssueColumn.title} (${coreIssueColumn.type})`);

  const settings = JSON.parse(coreIssueColumn.settings_str);
  console.log('\nAvailable tags in Monday.com:');

  if (settings.tags) {
    const mondayTags = {};
    for (const [tagId, tagData] of Object.entries(settings.tags)) {
      mondayTags[tagData.name] = parseInt(tagId);
      console.log(`  [${tagId}] ${tagData.name}`);
    }

    console.log(`\nTotal Monday tags: ${Object.keys(mondayTags).length}`);
  } else {
    console.log('  (No tags configured)');
  }
} else {
  console.log('❌ Core Issue column not found!');
}

// Step 2: Get all unique tags from NinjaRMM tickets
console.log('\n\n2️⃣  NINJARMM TICKET TAGS');
console.log('-'.repeat(80));

const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);

// Filter by date
const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000;
const recentTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);
console.log(`Analyzing ${recentTickets.length} tickets created on or after ${CONFIG.MIN_CREATE_DATE.toISOString().split('T')[0]}`);

// Extract unique tags
const ninjaTagCounts = new Map();
for (const ticket of recentTickets) {
  if (ticket.tags && ticket.tags.length > 0) {
    for (const tag of ticket.tags) {
      ninjaTagCounts.set(tag, (ninjaTagCounts.get(tag) || 0) + 1);
    }
  }
}

// Sort by frequency
const sortedNinjaTags = Array.from(ninjaTagCounts.entries())
  .sort((a, b) => b[1] - a[1]);

console.log('\nTags found in NinjaRMM tickets:');
for (const [tag, count] of sortedNinjaTags) {
  console.log(`  "${tag}" - ${count} ticket(s)`);
}

console.log(`\nTotal NinjaRMM tags: ${ninjaTagCounts.size}`);
console.log(`Tickets with tags: ${recentTickets.filter(t => t.tags && t.tags.length > 0).length}/${recentTickets.length}`);

console.log('\n' + '='.repeat(80));
console.log('\n💡 Next steps:');
console.log('   1. Compare the two tag lists above');
console.log('   2. Decide how to map NinjaRMM tags → Monday tags');
console.log('   3. Create missing tags in Monday.com or skip them');
console.log('\n');
