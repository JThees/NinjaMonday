/**
 * Full Sync: NinjaRMM Tickets → Monday.com
 *
 * This script performs the actual sync, creating items in Monday.com
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

// Configuration
const CONFIG = {
  NINJA: {
    CLIENT_ID: process.env.NINJA_CLIENT_ID,
    CLIENT_SECRET: process.env.NINJA_CLIENT_SECRET,
    BASE_URL: process.env.NINJA_BASE_URL || 'https://app.ninjarmm.com'
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
  NINJA_BOARD_IDS: [2], // "All tickets" board
  // Only sync tickets created on or after this date
  MIN_CREATE_DATE: new Date('2025-07-01T00:00:00Z'),
  BATCH_SIZE: 10, // Process tickets in batches to avoid rate limits
  DELAY_BETWEEN_ITEMS: 500 // ms delay between creating items
};

const logger = new Logger(true);

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a single Monday item with retry logic
 */
async function createMondayItem(mondayClient, boardId, itemName, columnValues, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await mondayClient.createItem(boardId, itemName, columnValues);
      return result;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      logger.warn(`Retry ${attempt}/${retries} for ${itemName}: ${error.message}`);
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}

/**
 * Main sync function
 */
async function sync() {
  logger.header('🔄 NINJA → MONDAY FULL SYNC');

  console.log('📋 Configuration:');
  console.log(`  Ninja Boards: ${CONFIG.NINJA_BOARD_IDS.join(', ')}`);
  console.log(`  Monday Kiosks Board: ${CONFIG.MONDAY.KIOSKS_BOARD_ID}`);
  console.log(`  Monday Tickets Board: ${CONFIG.MONDAY.TICKETS_BOARD_ID}`);
  console.log(`  Batch Size: ${CONFIG.BATCH_SIZE}`);
  console.log(`  Mode: FULL SYNC (items will be created)`);
  console.log();

  // Initialize clients
  const ninjaClient = new NinjaClient(
    CONFIG.NINJA.CLIENT_ID,
    CONFIG.NINJA.CLIENT_SECRET
  );

  const mondayClient = new MondayClient(
    CONFIG.MONDAY.API_TOKEN
  );

  try {
    // Step 1: Fetch kiosks from Monday for enrichment
    logger.section('Step 1: Fetching kiosk data from Monday.com ILH Kiosks board');
    const kiosks = await mondayClient.getBoardItems(CONFIG.MONDAY.KIOSKS_BOARD_ID);
    logger.success(`Fetched ${kiosks.length} kiosks`);

    const kioskLookup = buildKioskLookupMap(kiosks);
    logger.info(`Built lookup map for ${kioskLookup.size} kiosks`);

    // Step 2: Get next item number
    logger.section('Step 2: Getting next item number');
    let nextItemNumber = await mondayClient.getNextItemNumber(CONFIG.MONDAY.TICKETS_BOARD_ID);
    logger.success(`Starting from item number: ${nextItemNumber}`);

    // Step 3: Fetch existing tags
    logger.section('Step 3: Fetching existing tags from Monday.com');
    const existingTags = await mondayClient.getExistingTags(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.CORE_ISSUE
    );
    logger.success(`Found ${existingTags.size} existing tags`);

    // Step 4: Fetch existing Ninja Ticket IDs from Monday for duplicate detection
    logger.section('Step 4: Fetching existing tickets from Monday.com for duplicate detection');
    const existingTicketIds = await mondayClient.getExistingNinjaTicketIds(
      CONFIG.MONDAY.TICKETS_BOARD_ID,
      CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID
    );
    logger.success(`Found ${existingTicketIds.size} existing tickets in Monday`);

    // Step 5: Fetch all tickets from NinjaRMM
    logger.section('Step 5: Fetching tickets from NinjaRMM');
    const allTickets = await ninjaClient.getAllTickets(CONFIG.NINJA_BOARD_IDS);
    logger.success(`Fetched ${allTickets.length} tickets from NinjaRMM`);

    // Filter by date (only tickets created on or after MIN_CREATE_DATE)
    const minCreateTimestamp = CONFIG.MIN_CREATE_DATE.getTime() / 1000; // Convert to Unix timestamp
    const ninjaTickets = allTickets.filter(t => t.createTime >= minCreateTimestamp);
    logger.info(`${ninjaTickets.length} tickets created on or after ${CONFIG.MIN_CREATE_DATE.toISOString().split('T')[0]}`);

    // Step 6: Process and create tickets
    logger.section('Step 6: Creating tickets in Monday.com');

    logger.stats.total = ninjaTickets.length;
    const itemsToCreate = [];

    // First pass: filter out duplicates and prepare items
    for (const ticket of ninjaTickets) {
      const ticketId = String(ticket.id);

      // Check for duplicate
      if (existingTicketIds.has(ticketId)) {
        logger.skip(`Ticket #${ticketId} already exists in Monday`);
        continue;
      }

      // Extract data from Ninja ticket
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
        } else {
          logger.warn(`Kiosk ${shortKioskId} not found in ILH Kiosks board for ticket #${ticketId}`);
        }
      }

      // Build Monday.com column values
      const columnValues = {
        [CONFIG.MONDAY_COLUMNS.NINJA_TICKET_ID]: ticketId,
        [CONFIG.MONDAY_COLUMNS.KIOSK]: shortKioskId || '',
        [CONFIG.MONDAY_COLUMNS.DATE]: date || '',
        [CONFIG.MONDAY_COLUMNS.COUNTY]: county || '',
        [CONFIG.MONDAY_COLUMNS.LOCATION]: location || '',
        [CONFIG.MONDAY_COLUMNS.STATUS]: mondayStatus
      };

      itemsToCreate.push({
        columnValues,
        ticket,
        tags // Store tags for processing later
      });
    }

    logger.info(`Prepared ${itemsToCreate.length} items to create`);

    // Second pass: Create items in batches
    if (itemsToCreate.length === 0) {
      logger.info('No new items to create. All tickets already synced!');
    } else {
      console.log();
      for (let i = 0; i < itemsToCreate.length; i++) {
        const item = itemsToCreate[i];
        const itemName = String(nextItemNumber);
        const ticketId = item.ticket.id;

        try {
          // Handle tags - create or get tag IDs
          if (item.tags && item.tags.length > 0) {
            const tagIds = await mondayClient.ensureTags(
              CONFIG.MONDAY.TICKETS_BOARD_ID,
              item.tags,
              existingTags
            );
            item.columnValues[CONFIG.MONDAY_COLUMNS.CORE_ISSUE] = { tag_ids: tagIds };
          }

          logger.info(`Creating ${i + 1}/${itemsToCreate.length}: Item #${itemName} (Ninja Ticket #${ticketId})`);

          const result = await createMondayItem(
            mondayClient,
            CONFIG.MONDAY.TICKETS_BOARD_ID,
            itemName,
            item.columnValues
          );

          logger.success(`Created Monday item "${itemName}" (ID: ${result.id})`);

          // Increment item number for next iteration
          nextItemNumber++;

          // Rate limiting: delay between items
          if (i < itemsToCreate.length - 1) {
            await sleep(CONFIG.DELAY_BETWEEN_ITEMS);
          }

          // Progress update every 10 items
          if ((i + 1) % 10 === 0) {
            console.log(`  Progress: ${i + 1}/${itemsToCreate.length} items created`);
          }

        } catch (error) {
          logger.error(`Failed to create ticket #${item.ticket.id}: ${error.message}`);
          // Continue with next ticket even if one fails
        }
      }
    }

    // Step 7: Summary
    logger.printStats();

    console.log('✅ Sync complete!');
    console.log();
    console.log('Next steps:');
    console.log('  1. Check your Monday.com Tickets board to verify the data');
    console.log('  2. Run this script again to sync any new tickets');
    console.log('  3. Set up automation/scheduling if needed');
    console.log();

  } catch (error) {
    logger.error(`Sync failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run sync
sync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
