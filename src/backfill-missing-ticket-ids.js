/**
 * Retroactively add Ninja Ticket IDs to items that are missing them
 * Matches based on County, Location, and Core Issue
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';
import { toShortKioskId, buildKioskLookupMap } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CONFIG = {
  MONDAY_COLUMNS: {
    KIOSK: 'text_mkx0wqmq',
    COUNTY: 'text_mkwzhc6k',
    LOCATION: 'text_mkwzt5ce',
    CORE_ISSUE: 'tag_mkwzqtky',
    NINJA_TICKET_ID: 'text_mkxn628j'
  }
};

const ninjaClient = new NinjaClient(
  process.env.NINJA_CLIENT_ID,
  process.env.NINJA_CLIENT_SECRET
);

const mondayClient = new MondayClient(process.env.MONDAY_API_TOKEN);

console.log('🔧 Backfilling Missing Ninja Ticket IDs\n');
console.log('='.repeat(80));

// Step 1: Get all Monday items
console.log('\n📋 Fetching Monday.com items...');
const allMondayItems = await mondayClient.getBoardItems(process.env.MONDAY_TICKETS_BOARD_ID);
console.log(`   Found ${allMondayItems.length} total items`);

// Step 2: Find items without Ninja Ticket ID
const itemsWithoutTicketId = allMondayItems.filter(item => {
  const ninjaTicketIdCol = item.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID);
  return !ninjaTicketIdCol?.text;
});

console.log(`   Found ${itemsWithoutTicketId.length} items missing Ninja Ticket ID`);

if (itemsWithoutTicketId.length === 0) {
  console.log('\n✅ All items already have Ninja Ticket IDs!');
  process.exit(0);
}

// Step 3: Get all NinjaRMM tickets
console.log('\n🔍 Fetching NinjaRMM tickets...');
const ninjaTickets = await ninjaClient.getAllTickets([2]);
console.log(`   Found ${ninjaTickets.length} tickets`);

// Step 4: Get kiosk lookup for enrichment
console.log('\n📍 Loading kiosk data...');
const kiosks = await mondayClient.getBoardItems(process.env.MONDAY_KIOSKS_BOARD_ID);
const kioskLookup = buildKioskLookupMap(kiosks);
console.log(`   Loaded ${kioskLookup.size} kiosks`);

// Step 5: Match and update
console.log('\n🔄 Matching items to tickets...\n');

let matched = 0;
let updated = 0;
let failed = 0;

for (const mondayItem of itemsWithoutTicketId) {
  const itemNum = parseInt(mondayItem.name, 10);
  if (isNaN(itemNum)) continue;

  // Extract Monday item data
  const mondayKiosk = mondayItem.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.KIOSK)?.text || '';
  const mondayCounty = mondayItem.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.COUNTY)?.text || '';
  const mondayLocation = mondayItem.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.LOCATION)?.text || '';
  const mondayTags = mondayItem.column_values.find(cv => cv.id === CONFIG.MONDAY_COLUMNS.CORE_ISSUE)?.text || '';

  console.log(`Item #${mondayItem.name}:`);
  console.log(`  Kiosk: ${mondayKiosk || 'N/A'}`);
  console.log(`  County: ${mondayCounty || 'N/A'}`);
  console.log(`  Location: ${mondayLocation || 'N/A'}`);
  console.log(`  Tags: ${mondayTags || 'None'}`);

  // Try to find matching ticket
  let bestMatch = null;
  let bestScore = 0;

  for (const ticket of ninjaTickets) {
    let score = 0;
    let matches = [];

    // Get ticket data
    const ticketKioskId = ticket.device ? toShortKioskId(ticket.device) : null;
    let ticketCounty = ticket.attributeValues?.find(a => a.attributeId === 10)?.value || null;
    let ticketLocation = ticket.location || null;

    // Enrich with kiosk data if available
    if (ticketKioskId && kioskLookup.has(ticketKioskId)) {
      const kioskData = kioskLookup.get(ticketKioskId);
      if (!ticketCounty && kioskData.county) ticketCounty = kioskData.county;
      if (!ticketLocation && kioskData.location) ticketLocation = kioskData.location;
    }

    const ticketTags = (ticket.tags || []).join(', ');

    // Match on Kiosk ID
    if (mondayKiosk && ticketKioskId && mondayKiosk === ticketKioskId) {
      score += 10;
      matches.push('Kiosk');
    }

    // Match on County
    if (mondayCounty && ticketCounty && mondayCounty.toLowerCase() === ticketCounty.toLowerCase()) {
      score += 5;
      matches.push('County');
    }

    // Match on Location (fuzzy)
    if (mondayLocation && ticketLocation) {
      const mondayLoc = mondayLocation.toLowerCase();
      const ticketLoc = ticketLocation.toLowerCase();
      if (mondayLoc === ticketLoc) {
        score += 8;
        matches.push('Location (exact)');
      } else if (mondayLoc.includes(ticketLoc) || ticketLoc.includes(mondayLoc)) {
        score += 4;
        matches.push('Location (partial)');
      }
    }

    // Match on Tags
    if (mondayTags && ticketTags) {
      const mondayTagsLower = mondayTags.toLowerCase();
      const ticketTagsLower = ticketTags.toLowerCase();
      if (mondayTagsLower === ticketTagsLower) {
        score += 6;
        matches.push('Tags (exact)');
      } else if (mondayTagsLower.includes(ticketTagsLower) || ticketTagsLower.includes(mondayTagsLower)) {
        score += 3;
        matches.push('Tags (partial)');
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ticket, matches };
    }
  }

  // Update if we have a confident match
  if (bestMatch && bestScore >= 10) {
    console.log(`  ✅ MATCHED to Ticket #${bestMatch.ticket.id} (score: ${bestScore})`);
    console.log(`     Matches: ${bestMatch.matches.join(', ')}`);

    try {
      // Update the Monday item with the Ninja Ticket ID
      await mondayClient.updateItem(
        mondayItem.id,
        {
          [CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID]: String(bestMatch.ticket.id)
        }
      );
      console.log(`  ✅ Updated with Ninja Ticket ID: ${bestMatch.ticket.id}`);
      matched++;
      updated++;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`  ❌ Failed to update: ${error.message}`);
      failed++;
    }
  } else if (bestMatch) {
    console.log(`  ⚠️  Low confidence match (score: ${bestScore}) - skipping`);
    console.log(`     Best candidate: Ticket #${bestMatch.ticket.id} - ${bestMatch.matches.join(', ')}`);
  } else {
    console.log(`  ❌ No match found`);
  }

  console.log();
}

console.log('='.repeat(80));
console.log('\n📊 Summary:');
console.log(`   Items processed: ${itemsWithoutTicketId.length}`);
console.log(`   ✅ Successfully updated: ${updated}`);
console.log(`   ❌ Failed to update: ${failed}`);
console.log(`   ⏭️  Skipped (low confidence): ${itemsWithoutTicketId.length - matched}`);
console.log();
