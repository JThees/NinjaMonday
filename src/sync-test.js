/**
 * Test Sync: Create only 3 items for testing
 *
 * This is a safe test version that only creates 3 items
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NinjaClient } from './ninja-client.js';
import { MondayClient } from './monday-client.js';
import {
  Logger,
  toShortKioskId,
  unixToDate,
  getAttributeValue,
  buildKioskLookupMap
} from './utils.js';
import { mapStatus } from './status-mapping.js';

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
    KIOSKS_BOARD_ID: process.env.MONDAY_KIOSKS_BOARD_ID,
    TICKETS_BOARD_ID: process.env.MONDAY_TICKETS_BOARD_ID
  },
  MONDAY_COLUMNS: {
    KIOSK: 'text_mkx0wqmq',
    DATE: 'date4',
    COUNTY: 'text_mkwzhc6k',
    LOCATION: 'text_mkwzt5ce',
    CORE_ISSUE: 'tag_mkwzqtky',
    STATUS: 'status',
    NINJA_TICKET_ID: 'text_mkxkpphv'
  },
  NINJA_ATTRIBUTES: {
    KIOSK_ID: 54,
    COUNTY: 10
  },
  NINJA_BOARD_IDS: [2],
  // Only sync tickets created on or after this date
  MIN_CREATE_DATE: new Date('2025-07-01T00:00:00Z'),
  TEST_LIMIT: 3 // Only create 3 items for testing
};

const logger = new Logger(true);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSync() {
  logger.header('🧪 TEST SYNC (3 ITEMS ONLY)');

  console.log('⚠️  WARNING: This will create 3 actual items in Monday.com!');
  console.log('   Board ID:', CONFIG.MONDAY.TICKETS_BOARD_ID);
  console.log();

  const ninjaClient = new NinjaClient(CONFIG.NINJA.CLIENT_ID, CONFIG.NINJA.CLIENT_SECRET);
  const mondayClient = new MondayClient(CONFIG.MONDAY.API_TOKEN);

  try {
    // Fetch kiosks
    logger.section('Fetching kiosk data');
    const kiosks = await mondayClient.getBoardItems(CONFIG.MONDAY.KIOSKS_BOARD_ID);
    const kioskLookup = buildKioskLookupMap(kiosks);
    logger.success(`Loaded ${kioskLookup.size} kiosks`);

    // Get next item number
    logger.section('Getting next item number');
    let nextItemNumber = await mondayClient.getNextItemNumber(CONFIG.MONDAY.TICKETS_BOARD_ID);
    logger.success(`Starting from item number: ${nextItemNumber}`);

    // Fetch existing tags
    logger.section('Fetching existing tags from Monday.com');
    const existingTags = await mondayClient.getExistingTags(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.CORE_ISSUE
    );
    logger.success(`Found ${existingTags.size} existing tags`);

    // Fetch existing tickets
    logger.section('Checking for existing tickets');
    const existingTicketIds = await mondayClient.getExistingNinjaTicketIds(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID
    );
    logger.success(`Found ${existingTicketIds.size} existing tickets`);

    // Fetch tickets
    logger.section('Fetching tickets from NinjaRMM');
    const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);
    logger.success(`Fetched ${allTickets.length} tickets`);

    // Filter by date (only tickets created on or after MIN_CREATE_DATE)
    const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000; // Convert to Unix timestamp
    const recentTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);
    logger.info(`${recentTickets.length} tickets created on or after ${CONFIG.MIN_CREATE_DATE.toISOString().split('T')[0]}`);

    // Filter new tickets
    const newTickets = recentTickets.filter(t => !existingTicketIds.has(String(t.id)));
    logger.info(`${newTickets.length} new tickets to sync`);

    // Take only first 3 for testing
    const testTickets = newTickets.slice(0, CONFIG.TEST_LIMIT);

    if (testTickets.length === 0) {
      logger.info('No new tickets to test with!');
      return;
    }

    logger.section(`Creating ${testTickets.length} test items`);

    for (let i = 0; i < testTickets.length; i++) {
      const ticket = testTickets[i];
      const ticketId = String(ticket.id);

      // Extract data
      const fullKioskId = ticket.device || null;
      const shortKioskId = fullKioskId ? toShortKioskId(fullKioskId) : null;
      const date = unixToDate(ticket.createTime);
      const tags = ticket.tags || [];
      const ninjaStatus = ticket.status?.displayName || 'Unknown';
      const mondayStatus = mapStatus(ninjaStatus);

      // Get county from NinjaRMM attribute values as baseline
      const ninjaCounty = getAttributeValue(ticket.attributeValues, CONFIG.NINJA_ATTRIBUTES.COUNTY);

      // Enrich with kiosk data (overwrites if available)
      let county = ninjaCounty;
      let location = ticket.location || null;

      if (shortKioskId) {
        const kioskData = kioskLookup.get(shortKioskId);
        if (kioskData) {
          if (kioskData.county) county = kioskData.county;
          if (kioskData.location) location = kioskData.location;
        }
      }

      // Build column values
      const columnValues = {
        [CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID]: ticketId,
        [CONFIG.MONDAY_COLUMNS.KIOSK]: shortKioskId || '',
        [CONFIG.MONDAY_COLUMNS.DATE]: date || '',
        [CONFIG.MONDAY_COLUMNS.COUNTY]: county || '',
        [CONFIG.MONDAY_COLUMNS.LOCATION]: location || '',
        [CONFIG.MONDAY_COLUMNS.STATUS]: mondayStatus
      };

      // Handle tags - create or get tag IDs
      if (tags.length > 0) {
        const tagIds = await mondayClient.ensureTags(
          CONFIG.MONDAY.TICKETS_BOARD_ID,
          tags,
          existingTags
        );
        columnValues[CONFIG.MONDAY_COLUMNS.CORE_ISSUE] = { tag_ids: tagIds };
      }

      const itemName = String(nextItemNumber);

      logger.info(`Creating ${i + 1}/${testTickets.length}: Item #${itemName} (Ninja Ticket #${ticketId})`);

      try {
        const result = await mondayClient.createItem(
          CONFIG.MONDAY.TICKETS_BOARD_ID,
          itemName,
          columnValues
        );

        logger.success(`✅ Created Monday item "${itemName}" (ID: ${result.id})`);
        console.log(`   Ticket ID: ${ticketId}`);
        console.log(`   Kiosk: ${shortKioskId || 'N/A'}`);
        console.log(`   County: ${county || 'N/A'}`);
        console.log(`   Status: ${ninjaStatus} → ${mondayStatus}`);
        console.log();

        // Increment item number for next iteration
        nextItemNumber++;

        await sleep(500);

      } catch (error) {
        logger.error(`Failed to create ticket #${ticketId}: ${error.message}`);
        console.error(error);
      }
    }

    logger.header('TEST COMPLETE');
    console.log('✅ Created 3 test items successfully!');
    console.log();
    console.log('Next steps:');
    console.log('  1. Check your Monday.com board to verify the items look correct');
    console.log('  2. If everything looks good, run: npm run sync');
    console.log('  3. If there are issues, delete the test items and fix the problem');
    console.log();

  } catch (error) {
    logger.error(`Test sync failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

testSync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
